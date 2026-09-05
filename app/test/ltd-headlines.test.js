// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-headlines.test.js — proves the Ltd HEADLINES declaration in
// app/products/ltd.js against the three diya-gl Ltd fixtures, built the same
// way app/bin/report.js --data builds R, through the real shared reducer,
// headlinesFromReport() in app/lib/headlines.js.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { buildReportDocument } from "../lib/report-serializer.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { headlinesFromReport } from "../lib/headlines.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const BOOKS = [
  { name: "precision-code-ltd/full", dir: resolve(ROOT, "examples", "precision-code-ltd", "full"), expectedFile: "ltd-scenario-full.toml" },
  { name: "brickwork-pro/ltd-vat", dir: resolve(ROOT, "examples", "brickwork-pro", "ltd-vat"), expectedFile: "ltd-brickwork-pro-vat.toml" },
  {
    name: "brickwork-pro/ltd-nonvat",
    dir: resolve(ROOT, "examples", "brickwork-pro", "ltd-nonvat"),
    expectedFile: "ltd-brickwork-pro-nonvat.toml",
  },
];

// R for one fixture, built the way report.js's --data mode builds it for
// Ltd: load the book, derive the scenario, run the pure JS multi-file
// calculator, then serialize through the one module both engines write R
// through.
function buildReport(dir) {
  const { book, lines } = loadDiyaGlData(dir);
  const scenario = diyaGlToScenario(book, lines, "ltd");
  const taxData = extractTaxDataFromBook(book, "ltd");
  const results = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);
  const merged = { ...scenario, ...scenario.expected };
  const yearEnd = new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);
  const checks = ltd.checkCompliance({ ...results }, merged, taxData, calculateExpectedTax, yearEnd);
  const report = buildReportDocument({ packageName: "ltd", engine: "js", results, productMod: ltd, scenario: merged, checks });
  return { report, results };
}

function expectedTotals(expectedFile) {
  return loadScenario(resolve(FIXTURES_DIR, expectedFile)).expected;
}

// Every cell key the declaration names, gathered the same way the shared
// reducer reads them, so "every key is present in R" and "no cell is
// absent from standardReads()" check the declaration as it is actually
// used rather than a hand-picked subset.
function allDeclaredKeys(declaration) {
  const keys = [];
  const collect = (spec) => {
    if (!spec) return;
    if (spec.keys) keys.push(...spec.keys);
    else if (spec.key) keys.push(spec.key);
  };
  collect(declaration.turnover);
  for (const line of declaration.turnover.pieExtra ?? []) keys.push(line.key);
  collect(declaration.costOfSales);
  collect(declaration.runningCosts);
  collect(declaration.tax);
  collect(declaration.tax.secondLine);
  collect(declaration.assets.writtenDown);
  collect(declaration.assets.stock);
  collect(declaration.assets.secondLine);
  for (const [key] of declaration.expenseLines) keys.push(key);
  return keys;
}

function sumShares(slices) {
  return slices.reduce((total, slice) => total + slice.share, 0);
}

describe.each(BOOKS)("Ltd HEADLINES — $name", ({ dir, expectedFile }) => {
  const { report } = buildReport(dir);

  it("every key in the declaration is present in R", () => {
    const foundKeys = new Set(report.values.map((entry) => entry.key));
    for (const key of allDeclaredKeys(ltd.HEADLINES)) {
      expect(foundKeys.has(key), `missing ${key}`).toBe(true);
    }
  });

  it("names no cell absent from the March CELL_MAP or standardReads()", () => {
    const reads = ltd.standardReads();
    for (const key of allDeclaredKeys(ltd.HEADLINES)) {
      // Every HEADLINES key is a hub cell: "cell/Financialaccounts.xlsx!<Sheet>!<Cell>".
      const [, sheet, cell] = key.match(/^cell\/Financialaccounts\.xlsx!([^!]+)!(.+)$/) ?? [];
      expect(sheet, `${key} is not a Financialaccounts.xlsx cell key`).toBeDefined();
      expect(reads[sheet] ?? [], `${key} is not in standardReads()`).toContain(cell);
    }
  });

  it("the outgoings pie sums to cost of sales plus administrative expenses and shows at most six slices", () => {
    const headlines = headlinesFromReport(report, ltd.HEADLINES);
    const { slices } = headlines.pies.outgoings;
    expect(slices.length).toBeLessThanOrEqual(6);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    expect(total).toBeCloseTo(headlines.tiles.outgoings.total.value, 6);
    if (headlines.tiles.outgoings.total.value !== 0) expect(sumShares(slices)).toBeCloseTo(1, 9);
  });

  it("the five turnover-pie slices sum to turnover", () => {
    const headlines = headlinesFromReport(report, ltd.HEADLINES);
    const { slices } = headlines.pies.turnover;
    expect(slices).toHaveLength(5);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    expect(total).toBeCloseTo(headlines.tiles.turnover.value, 6);
  });

  it("the turnover pie names the running-costs and tax slices with the Ltd sheet's own words, not BST's", () => {
    const headlines = headlinesFromReport(report, ltd.HEADLINES);
    const labels = headlines.pies.turnover.slices.map((slice) => slice.label);
    expect(labels).toContain("Administrative expenses");
    expect(labels).toContain("Corporation tax");
    expect(labels).not.toContain("Running costs");
    expect(labels).not.toContain("Tax and NI");
  });

  it("the tax tile carries the working sheet's charge and its second line, tax outstanding", () => {
    const headlines = headlinesFromReport(report, ltd.HEADLINES);
    expect(headlines.tiles.tax.value).toBeCloseTo(
      report.values.find((v) => v.key === "cell/Financialaccounts.xlsx!CorporationTax!K35").value,
      6,
    );
    expect(headlines.tiles.tax.secondLine).toEqual({
      label: "Tax outstanding",
      value: expect.any(Number),
      from: ["cell/Financialaccounts.xlsx!CorporationTax!K39"],
    });
    expect(headlines.tiles.tax.secondLine.value).toBeCloseTo(
      report.values.find((v) => v.key === "cell/Financialaccounts.xlsx!CorporationTax!K39").value,
      6,
    );
  });

  it("the assets tile's total carries its second line, net assets, and stays out of the sum", () => {
    const headlines = headlinesFromReport(report, ltd.HEADLINES);
    expect(headlines.tiles.assets.total.secondLine.label).toBe("Net assets");
    const netAssetsCell = report.values.find((v) => v.key === "cell/Financialaccounts.xlsx!PubBalSht!F33").value;
    expect(headlines.tiles.assets.total.secondLine.value).toBeCloseTo(netAssetsCell, 6);
    expect(headlines.tiles.assets.total.value).toBeCloseTo(
      headlines.tiles.assets.writtenDown.value + headlines.tiles.assets.stock.value,
      6,
    );
    // Net assets is a different figure from the assets total (it nets off
    // liabilities), so nothing says they must be close on a real book --
    // this only proves the second line traces to its own cell, not the sum.
    expect(headlines.tiles.assets.total.from).not.toContain("cell/Financialaccounts.xlsx!PubBalSht!F33");
  });

  it("Ltd declares no separate debtors part, since the current-assets cell already includes it", () => {
    const headlines = headlinesFromReport(report, ltd.HEADLINES);
    expect(headlines.tiles.assets.debtors).toEqual({ value: 0, from: [], missing: true });
  });
});

// ── The full fixture's own expected total, anchored independently ──

describe("Ltd HEADLINES — precision-code-ltd/full", () => {
  const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "full"));
  const expected = expectedTotals("ltd-scenario-full.toml");

  it("the turnover tile equals the fixture's own expected total_sales", () => {
    const headlines = headlinesFromReport(report, ltd.HEADLINES);
    // The fixture's own [expected] figure is rounded to the pound, the same
    // tolerance the "Total Sales" compliance check applies.
    expect(Math.abs(headlines.tiles.turnover.value - expected.total_sales)).toBeLessThan(1);
    expect(headlines.tiles.turnover.from).toEqual(["cell/Financialaccounts.xlsx!MnthP&L!B9"]);
  });

  it("the turnover pie stays in pie mode for a profitable year, dividends included", () => {
    const headlines = headlinesFromReport(report, ltd.HEADLINES);
    expect(headlines.pies.turnover.mode).toBe("pie");
    const dividends = headlines.pies.turnover.slices.find((slice) => slice.label === "Dividends");
    expect(dividends.value).toBeCloseTo(15000, 6);
  });
});

// ── Breakability: corrupting the dividends cell moves only the dividends
// slice and Kept, nothing else ──

describe("Ltd HEADLINES is breakable: corrupting the dividends cell moves only the tiles that trace to it", () => {
  it("zeroing PubP&L!F52 moves the dividends slice and Kept, and leaves every other tile and slice byte-equal", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "full"));
    const before = headlinesFromReport(report, ltd.HEADLINES);
    const corrupted = {
      ...report,
      values: report.values.map((entry) => (entry.key === "cell/Financialaccounts.xlsx!PubP&L!F52" ? { ...entry, value: "0" } : entry)),
    };
    const after = headlinesFromReport(corrupted, ltd.HEADLINES);

    expect(after.tiles.turnover).toEqual(before.tiles.turnover);
    expect(after.tiles.outgoings).toEqual(before.tiles.outgoings);
    expect(after.tiles.tax).toEqual(before.tiles.tax);
    expect(after.tiles.assets).toEqual(before.tiles.assets);
    expect(after.pies.outgoings).toEqual(before.pies.outgoings);

    const beforeDividends = before.pies.turnover.slices.find((slice) => slice.label === "Dividends");
    const afterDividends = after.pies.turnover.slices.find((slice) => slice.label === "Dividends");
    const beforeKept = before.pies.turnover.slices.find((slice) => slice.label === "Kept");
    const afterKept = after.pies.turnover.slices.find((slice) => slice.label === "Kept");
    expect(afterDividends.value).toBe(0);
    expect(afterDividends.value).not.toBe(beforeDividends.value);
    expect(afterKept.value).not.toBe(beforeKept.value);
    expect(afterKept.value).toBeCloseTo(beforeKept.value + beforeDividends.value, 6);

    for (const label of ["Cost of sales", "Administrative expenses", "Corporation tax"]) {
      const b = before.pies.turnover.slices.find((slice) => slice.label === label);
      const a = after.pies.turnover.slices.find((slice) => slice.label === label);
      expect(a).toEqual(b);
    }
  });

  it("a book that declares no dividend reads the pie slice as zero with an empty trail", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "full"));
    const withoutDividends = { ...report, values: report.values.filter((entry) => entry.key !== "cell/Financialaccounts.xlsx!PubP&L!F52") };
    const headlines = headlinesFromReport(withoutDividends, ltd.HEADLINES);
    const dividends = headlines.pies.turnover.slices.find((slice) => slice.label === "Dividends");
    expect(dividends).toEqual({ label: "Dividends", value: 0, from: [], share: 0 });
  });
});
