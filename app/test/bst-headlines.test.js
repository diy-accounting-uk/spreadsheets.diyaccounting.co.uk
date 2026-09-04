// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Proves headlinesFromReport() against BST's own HEADLINES declaration over
// the three diya-gl BST fixtures, built the same way app/bin/report.js's
// --data mode builds R: no LibreOffice, no xlsx, the JS calculator straight
// into buildReportDocument().

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateBstResults } from "../lib/calculators/bst.js";
import * as bst from "../products/bst.js";
import { buildReportDocument } from "../lib/report-serializer.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { headlinesFromReport } from "../lib/headlines.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

const BOOKS = [
  { name: "precision-code-ltd/bst", dir: resolve(ROOT, "examples", "precision-code-ltd", "bst"), expectedFile: "bst-scenario-basic.toml" },
  { name: "sp-sixty-driving/bst", dir: resolve(ROOT, "examples", "sp-sixty-driving", "bst"), expectedFile: "bst-sp-sixty.toml" },
  {
    name: "brickwork-pro/bst-nonvat",
    dir: resolve(ROOT, "examples", "brickwork-pro", "bst-nonvat"),
    expectedFile: "bst-brickwork-pro-nonvat.toml",
  },
];

// R for one fixture, built the way report.js's --data mode builds it: load
// the book, derive the scenario, run the pure JS calculator, then serialize
// through the one module both engines write R through.
function buildReport(dir) {
  const { book, lines } = loadDiyaGlData(dir);
  const scenario = diyaGlToScenario(book, lines, "bst");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateBstResults(book, lines, taxData, merged);
  const checks = bst.checkCompliance(results, merged, taxData, calculateExpectedTax);
  const report = buildReportDocument({ packageName: "bst", engine: "js", results, productMod: bst, scenario: merged, checks });
  return { report, results };
}

// The fixture's own [expected] block, an independent anchor loaded from its
// own file rather than derived from the same book the report came from.
function expectedTotals(expectedFile) {
  return loadScenario(resolve(FIXTURES_DIR, expectedFile)).expected;
}

function sumShares(slices) {
  return slices.reduce((total, slice) => total + slice.share, 0);
}

describe.each(BOOKS)("headlinesFromReport — $name", ({ dir, expectedFile }) => {
  const { report, results } = buildReport(dir);
  const headlines = headlinesFromReport(report, bst.HEADLINES);
  const expected = expectedTotals(expectedFile);
  const pl = results["Profit & Loss Acc"];

  it("turnover matches the fixture's own expected total_sales", () => {
    expect(headlines.tiles.turnover.value).toBe(expected.total_sales);
    expect(headlines.tiles.turnover.from).toEqual(["cell/Profit & Loss Acc!C4"]);
  });

  it("outgoings total is cost of sales plus direct costs plus total expenses read from R", () => {
    expect(headlines.tiles.outgoings.total.value).toBeCloseTo(pl.C6 + pl.C7 + pl.C22, 6);
    expect(headlines.tiles.outgoings.costOfSales.value).toBeCloseTo(pl.C6 + pl.C7, 6);
    expect(headlines.tiles.outgoings.runningCosts.value).toBeCloseTo(pl.C22, 6);
  });

  it("turnover minus outgoings equals net profit within a penny", () => {
    const netProfit = headlines.tiles.turnover.value - headlines.tiles.outgoings.total.value;
    expect(Math.abs(netProfit - pl.C24)).toBeLessThan(0.01);
  });

  it("assets total is written-down value plus stock, with what customers owe kept out of it", () => {
    expect(headlines.tiles.assets.total.value).toBeCloseTo(
      headlines.tiles.assets.writtenDown.value + headlines.tiles.assets.stock.value,
      6,
    );
    // What customers owe is still reported, and the total does not trace
    // back to its cell.
    expect(headlines.tiles.assets.debtors.value).toBe(results["Debtors & Creditors"].C29 ?? 0);
    expect(headlines.tiles.assets.total.from).not.toContain("cell/Debtors & Creditors!C29");
  });

  it("tax matches the sheet's total tax and NI less CIS", () => {
    expect(headlines.tiles.tax.value).toBeCloseTo(results["Income Tax"].E18, 6);
  });

  it("the four DOM hook keys carry the tile totals", () => {
    expect(headlines.keys["headline/turnover"]).toBe(headlines.tiles.turnover.value);
    expect(headlines.keys["headline/outgoings"]).toBe(headlines.tiles.outgoings.total.value);
    expect(headlines.keys["headline/assets"]).toBe(headlines.tiles.assets.total.value);
    expect(headlines.keys["headline/tax"]).toBe(headlines.tiles.tax.value);
  });

  it("the turnover pie's four slices sum to turnover and their shares sum to 1", () => {
    const { slices } = headlines.pies.turnover;
    expect(slices).toHaveLength(4);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    expect(total).toBeCloseTo(headlines.tiles.turnover.value, 6);
    expect(sumShares(slices)).toBeCloseTo(1, 9);
  });

  it("the turnover pie stays in pie mode for a profitable year", () => {
    expect(headlines.pies.turnover.mode).toBe("pie");
    expect(headlines.pies.turnover).not.toHaveProperty("reason");
  });

  it("the outgoings pie never exceeds six slices, folds the remainder into Other, and its shares sum to 1", () => {
    const { slices } = headlines.pies.outgoings;
    expect(slices.length).toBeLessThanOrEqual(6);
    expect(sumShares(slices)).toBeCloseTo(1, 9);
    for (const slice of slices) expect(slice.value).not.toBe(0);
  });
});

// ── The Other fold, worked through precision-code-ltd/bst's own figures ──

describe("headlinesFromReport — outgoings pie folds the smallest categories into Other", () => {
  const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
  const { pies } = headlinesFromReport(report, bst.HEADLINES);

  it("shows the five largest categories by label, largest first", () => {
    const labels = pies.outgoings.slices.map((slice) => slice.label);
    expect(labels.slice(0, 5)).toEqual(["Employee Costs", "Cost of sales", "Other Expenses", "Premises Costs", "Motor Expenses"]);
  });

  it("keeps what customers owe out of the assets total, which it would otherwise dwarf", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const { tiles } = headlinesFromReport(report, bst.HEADLINES);
    // This book records few settlements, so the sheet's "Amount owed by
    // customers" runs close to the year's turnover -- far past anything the
    // business actually holds.
    expect(tiles.assets.debtors.value).toBeGreaterThan(tiles.assets.total.value * 10);
    expect(tiles.assets.total.value).toBeCloseTo(tiles.assets.writtenDown.value + tiles.assets.stock.value, 6);
  });

  it("folds everything past the top five into one Other slice, valued at the true remainder", () => {
    const other = pies.outgoings.slices.find((slice) => slice.label === "Other");
    expect(other).toBeDefined();
    // Advertising, Legal & Professional, General Admin, Travel & Subsistence,
    // Repairs & Maintenance, Interest & Finance, Bad Debts.
    expect(other.value).toBeCloseTo(4560 + 4560 + 1962 + 1860 + 1140 + 750 + 500, 6);
    expect(pies.outgoings.slices).toHaveLength(6);
  });
});

// ── sp-sixty-driving/bst: an optional asset part genuinely absent ──

describe("headlinesFromReport — an absent optional key reads as zero with an empty trail", () => {
  it("a book with no fixed-asset write-down states writtenDown as 0 and missing:true", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "sp-sixty-driving", "bst"));
    const withoutAssets = { ...report, values: report.values.filter((entry) => entry.key !== "cell/Fixed Assets!M1") };
    const headlines = headlinesFromReport(withoutAssets, bst.HEADLINES);
    expect(headlines.tiles.assets.writtenDown).toEqual({ value: 0, from: [], missing: true });
    expect(headlines.tiles.assets.total.value).toBeCloseTo(headlines.tiles.assets.stock.value, 6);
  });
});

// ── The loss branch: turn a profitable book into a loss by editing R's own value strings ──

describe("headlinesFromReport — the loss branch draws a bar, not a pie", () => {
  function withValue(report, key, value) {
    return {
      ...report,
      values: report.values.map((entry) => (entry.key === key ? { ...entry, value: String(value) } : entry)),
    };
  }

  it("a turnover cut below outgoings puts the turnover pie in bar mode with a loss reason", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const lossReport = withValue(report, "cell/Profit & Loss Acc!C4", 1000);
    const headlines = headlinesFromReport(lossReport, bst.HEADLINES);

    expect(headlines.tiles.turnover.value).toBe(1000);
    const kept = headlines.pies.turnover.slices.find((slice) => slice.label === "Kept");
    expect(kept.value).toBeLessThan(0);
    expect(headlines.pies.turnover.mode).toBe("bar");
    expect(headlines.pies.turnover.reason).toMatch(/loss/);
    // The bridge still balances and shares still sum to 1, loss or not.
    const total = headlines.pies.turnover.slices.reduce((sum, slice) => sum + slice.value, 0);
    expect(total).toBeCloseTo(1000, 6);
    expect(sumShares(headlines.pies.turnover.slices)).toBeCloseTo(1, 9);
  });

  it("a negative tax slice also puts the turnover pie in bar mode, with a different reason", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const refundReport = withValue(report, "cell/Income Tax!E18", -500);
    const headlines = headlinesFromReport(refundReport, bst.HEADLINES);

    expect(headlines.pies.turnover.mode).toBe("bar");
    expect(headlines.pies.turnover.reason).not.toMatch(/loss/);
  });
});

// ── The missing-key error ──

describe("headlinesFromReport — a required key with no value in R is an error naming the key", () => {
  it("throws naming the missing key rather than defaulting to zero", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const withoutTurnover = { ...report, values: report.values.filter((entry) => entry.key !== "cell/Profit & Loss Acc!C4") };
    expect(() => headlinesFromReport(withoutTurnover, bst.HEADLINES)).toThrow("cell/Profit & Loss Acc!C4");
  });

  it("throws when a required key's value cannot be read as a number", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const corrupted = {
      ...report,
      values: report.values.map((entry) => (entry.key === "cell/Income Tax!E18" ? { ...entry, value: "n/a" } : entry)),
    };
    expect(() => headlinesFromReport(corrupted, bst.HEADLINES)).toThrow("cell/Income Tax!E18");
  });
});

// ── Breakability: one corrupted R value moves exactly the tiles that trace to it ──

describe("headlinesFromReport is breakable: corrupting one R value moves only the tiles that trace to it", () => {
  // Total Expenses (C22) is its own cell in R, not a sum this module takes
  // over the eleven expense lines, so corrupting one line moves only the
  // outgoings pie's own slice for that line -- every tile stays byte-equal.
  it("corrupting the general admin expense line moves only its own outgoings-pie slice", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const before = headlinesFromReport(report, bst.HEADLINES);
    const corrupted = {
      ...report,
      values: report.values.map((entry) => (entry.key === "cell/Profit & Loss Acc!C14" ? { ...entry, value: "999999" } : entry)),
    };
    const after = headlinesFromReport(corrupted, bst.HEADLINES);

    expect(after.tiles).toEqual(before.tiles);
    expect(after.pies.turnover).toEqual(before.pies.turnover);
    expect(after.pies.outgoings).not.toEqual(before.pies.outgoings);
    // General Admin was 1,962, folded into Other; at 999,999 it outranks
    // every other category and takes the top slice instead.
    expect(after.pies.outgoings.slices[0]).toMatchObject({ label: "General Admin", value: 999999 });
    expect(before.pies.outgoings.slices.some((slice) => slice.label === "General Admin")).toBe(false);
  });

  it("corrupting the fixed-asset written-down value moves only the assets tile", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const before = headlinesFromReport(report, bst.HEADLINES);
    const corrupted = {
      ...report,
      values: report.values.map((entry) => (entry.key === "cell/Fixed Assets!M1" ? { ...entry, value: "12345" } : entry)),
    };
    const after = headlinesFromReport(corrupted, bst.HEADLINES);

    expect(after.tiles.turnover).toEqual(before.tiles.turnover);
    expect(after.tiles.outgoings).toEqual(before.tiles.outgoings);
    expect(after.tiles.tax).toEqual(before.tiles.tax);
    expect(after.pies).toEqual(before.pies);
    expect(after.tiles.assets.writtenDown.value).toBe(12345);
    expect(after.tiles.assets.total.value).not.toBe(before.tiles.assets.total.value);
  });

  it("corrupting what customers owe moves that figure and leaves the assets total alone", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const before = headlinesFromReport(report, bst.HEADLINES);
    const corrupted = {
      ...report,
      values: report.values.map((entry) => (entry.key === "cell/Debtors & Creditors!C29" ? { ...entry, value: "999" } : entry)),
    };
    const after = headlinesFromReport(corrupted, bst.HEADLINES);

    expect(after.tiles.assets.debtors.value).toBe(999);
    expect(after.tiles.assets.total.value).toBe(before.tiles.assets.total.value);
    expect(after.keys["headline/assets"]).toBe(before.keys["headline/assets"]);
  });
});

// ── The declaration argument ──

describe("headlinesFromReport — the declaration is required", () => {
  it("throws naming the declaration when called with one argument", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    expect(() => headlinesFromReport(report)).toThrow("declaration");
  });
});

describe("headlinesFromReport — an empty secondLine and extra leave the BST figures unchanged", () => {
  it("declaring empty turnover.secondLine and assets.extra produces the same result as declaring neither", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const declarationWithEmptyOptionals = {
      ...bst.HEADLINES,
      turnover: { ...bst.HEADLINES.turnover, secondLine: [] },
      assets: { ...bst.HEADLINES.assets, extra: [] },
    };

    const withoutOptionals = headlinesFromReport(report, bst.HEADLINES);
    const withEmptyOptionals = headlinesFromReport(report, declarationWithEmptyOptionals);

    expect(withEmptyOptionals).toEqual(withoutOptionals);
  });
});
