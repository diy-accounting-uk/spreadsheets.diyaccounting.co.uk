// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-headlines.test.js — proves the Ltd HEADLINES declaration in
// app/products/ltd.js against the three diya-gl Ltd fixtures, built the same
// way app/bin/report.js --data builds R.
//
// The shared, product-agnostic headline reducer has not landed yet, so
// there is no app/lib/headlines.js to import: headlinesFromReport(report,
// declaration) does not exist. This file runs the declaration through a
// local copy of bst-headlines.js's reducer functions (readCell, addFigures,
// turnoverPie, outgoingsPie), adapted to read the wrapped {key}/{keys}
// declaration shape the shared reducer is designed around. Once it lands,
// this local copy is replaced by the real import.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { buildReportDocument } from "../lib/report-serializer.js";
import { loadScenario } from "../lib/scenario-loader.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const BOOKS = [
  { name: "precision-code-ltd/full", dir: resolve(ROOT, "examples", "precision-code-ltd", "full"), expectedFile: "ltd-scenario-full.toml" },
  { name: "brickwork-pro/ltd-vat", dir: resolve(ROOT, "examples", "brickwork-pro", "ltd-vat"), expectedFile: "ltd-brickwork-pro-vat.toml" },
  { name: "brickwork-pro/ltd-nonvat", dir: resolve(ROOT, "examples", "brickwork-pro", "ltd-nonvat"), expectedFile: "ltd-brickwork-pro-nonvat.toml" },
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

// ── A local reducer copy of bst-headlines.js's functions, reading the
// wrapped declaration shape: {key}, {key, optional} or {keys: [...]}
// summed. Replace with the real import once the shared reducer lands. ──

function readCell(report, key, { optional = false } = {}) {
  const entry = report.values.find((value) => value.key === key);
  if (!entry) {
    if (optional) return { value: 0, from: [], missing: true };
    throw new Error(`local reducer: report carries no value for ${key}`);
  }
  const value = Number(entry.value);
  if (!Number.isFinite(value)) {
    throw new Error(`local reducer: ${key} is "${entry.value}", not a number`);
  }
  return { value, from: [key] };
}

function addFigures(...figures) {
  return {
    value: figures.reduce((total, figure) => total + figure.value, 0),
    from: figures.flatMap((figure) => figure.from),
  };
}

function readSpec(report, spec) {
  if (spec.keys) return addFigures(...spec.keys.map((key) => readCell(report, key)));
  return readCell(report, spec.key, { optional: spec.optional });
}

function allDeclaredKeys(declaration) {
  const keys = [];
  const collect = (spec) => {
    if (spec.keys) keys.push(...spec.keys);
    else keys.push(spec.key);
  };
  collect(declaration.turnover);
  collect(declaration.costOfSales);
  collect(declaration.runningCosts);
  collect(declaration.tax);
  collect(declaration.taxSecond);
  collect(declaration.dividends);
  collect(declaration.assets.writtenDown);
  collect(declaration.assets.current);
  collect(declaration.assetsSecond);
  for (const [key] of declaration.expenseLines) keys.push(key);
  return keys;
}

const OUTGOINGS_SLICE_CAP = 5;

// The five-slice bridge from turnover to what is left: cost of sales,
// administrative expenses, corporation tax, dividends, then whatever
// remains. A negative remainder or a negative slice cannot be shown as a
// pie, so a bar mode is signalled instead -- this is the reducer's own
// branch, mirrored here only so the fixtures' profitable years prove the
// pie branch.
function turnoverPie(turnover, costOfSales, runningCosts, runningCostsLabel, tax, dividends) {
  const kept = turnover.value - costOfSales.value - runningCosts.value - tax.value - dividends.value;
  const slices = [
    { label: "Cost of sales", value: costOfSales.value, from: costOfSales.from },
    { label: runningCostsLabel, value: runningCosts.value, from: runningCosts.from },
    { label: "Corporation tax", value: tax.value, from: tax.from },
    { label: "Dividends", value: dividends.value, from: dividends.from },
    {
      label: "Kept",
      value: kept,
      from: [...turnover.from, ...costOfSales.from, ...runningCosts.from, ...tax.from, ...dividends.from],
    },
  ];
  const withShares = slices.map((slice) => ({ ...slice, share: turnover.value === 0 ? 0 : slice.value / turnover.value }));
  const negative = withShares.filter((slice) => slice.value < 0);
  if (negative.length > 0) {
    const reason =
      kept < 0
        ? "the year ran at a loss, so turnover cannot be split into positive slices"
        : "one of the turnover slices is negative, so it cannot be split into positive slices";
    return { mode: "bar", reason, slices: withShares };
  }
  return { mode: "pie", slices: withShares };
}

// The largest of the twenty-six P&L lines, up to five, everything else
// folded into one "Other" slice.
function outgoingsPie(expenseLines, outgoingsTotal) {
  const candidates = expenseLines.filter((candidate) => candidate.value !== 0);
  const ranked = [...candidates].sort((a, b) => b.value - a.value);
  const shown = ranked.slice(0, OUTGOINGS_SLICE_CAP);
  const rest = ranked.slice(OUTGOINGS_SLICE_CAP);
  const slices = [...shown];
  if (rest.length > 0) {
    slices.push({
      label: "Other",
      value: rest.reduce((total, candidate) => total + candidate.value, 0),
      from: rest.flatMap((candidate) => candidate.from),
    });
  }
  return {
    slices: slices
      .filter((slice) => slice.value !== 0)
      .map((slice) => ({ ...slice, share: outgoingsTotal.value === 0 ? 0 : slice.value / outgoingsTotal.value })),
  };
}

function headlinesFromDeclaration(report, declaration) {
  const turnover = readSpec(report, declaration.turnover);
  const costOfSales = readSpec(report, declaration.costOfSales);
  const runningCosts = readSpec(report, declaration.runningCosts);
  const tax = readSpec(report, declaration.tax);
  const taxSecond = readSpec(report, declaration.taxSecond);
  const dividends = readSpec(report, declaration.dividends);
  const writtenDown = readSpec(report, declaration.assets.writtenDown);
  const current = readSpec(report, declaration.assets.current);
  const assetsTotal = addFigures(writtenDown, current);
  const assetsSecond = readSpec(report, declaration.assetsSecond);
  const outgoingsTotal = addFigures(costOfSales, runningCosts);

  const expenseLines = declaration.expenseLines.map(([key, label]) => {
    const figure = readCell(report, key);
    return { label, value: figure.value, from: figure.from };
  });

  const tiles = {
    turnover,
    outgoings: { total: outgoingsTotal, costOfSales, runningCosts },
    assets: { total: assetsTotal, writtenDown, current, second: assetsSecond },
    tax: { ...tax, second: taxSecond },
  };

  const pies = {
    turnover: turnoverPie(turnover, costOfSales, runningCosts, declaration.runningCostsLabel, tax, dividends),
    outgoings: outgoingsPie(expenseLines, outgoingsTotal),
  };

  return { tiles, pies };
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
    const headlines = headlinesFromDeclaration(report, ltd.HEADLINES);
    const { slices } = headlines.pies.outgoings;
    expect(slices.length).toBeLessThanOrEqual(6);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    expect(total).toBeCloseTo(headlines.tiles.outgoings.total.value, 6);
    if (headlines.tiles.outgoings.total.value !== 0) expect(sumShares(slices)).toBeCloseTo(1, 9);
  });

  it("the five turnover-pie slices sum to turnover", () => {
    const headlines = headlinesFromDeclaration(report, ltd.HEADLINES);
    const { slices } = headlines.pies.turnover;
    expect(slices).toHaveLength(5);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    expect(total).toBeCloseTo(headlines.tiles.turnover.value, 6);
  });

  it("the tax tile carries the working sheet's charge and its second line, tax outstanding", () => {
    const headlines = headlinesFromDeclaration(report, ltd.HEADLINES);
    expect(headlines.tiles.tax.value).toBeCloseTo(report.values.find((v) => v.key === "cell/Financialaccounts.xlsx!CorporationTax!K35").value, 6);
    expect(headlines.tiles.tax.second.value).toBeCloseTo(report.values.find((v) => v.key === "cell/Financialaccounts.xlsx!CorporationTax!K39").value, 6);
  });
});

// ── The full fixture's own expected total, anchored independently ──

describe("Ltd HEADLINES — precision-code-ltd/full", () => {
  const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "full"));
  const expected = expectedTotals("ltd-scenario-full.toml");

  it("the turnover tile equals the fixture's own expected total_sales", () => {
    const headlines = headlinesFromDeclaration(report, ltd.HEADLINES);
    // The fixture's own [expected] figure is rounded to the pound, the same
    // tolerance the "Total Sales" compliance check applies.
    expect(Math.abs(headlines.tiles.turnover.value - expected.total_sales)).toBeLessThan(1);
    expect(headlines.tiles.turnover.from).toEqual(["cell/Financialaccounts.xlsx!MnthP&L!B9"]);
  });

  it("the turnover pie stays in pie mode for a profitable year, dividends included", () => {
    const headlines = headlinesFromDeclaration(report, ltd.HEADLINES);
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
    const before = headlinesFromDeclaration(report, ltd.HEADLINES);
    const corrupted = {
      ...report,
      values: report.values.map((entry) => (entry.key === "cell/Financialaccounts.xlsx!PubP&L!F52" ? { ...entry, value: "0" } : entry)),
    };
    const after = headlinesFromDeclaration(corrupted, ltd.HEADLINES);

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
});
