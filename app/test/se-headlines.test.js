// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-headlines.test.js — proves the SE HEADLINES declaration in
// app/products/se.js against the three diya-gl SE fixtures, built the same
// way app/bin/report.js --data builds R, through the real shared reducer,
// headlinesFromReport() in app/lib/headlines.js. No LibreOffice: the engine
// never opens a workbook.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { buildReportDocument } from "../lib/report-serializer.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { headlinesFromReport } from "../lib/headlines.js";
import * as se from "../products/se.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const TAX_DATA = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

const BOOKS = [
  {
    name: "precision-code-ltd/advanced",
    dir: resolve(ROOT, "examples", "precision-code-ltd", "advanced"),
    expectedFile: "se-scenario-advanced.toml",
  },
  {
    name: "brickwork-pro/se-vat",
    dir: resolve(ROOT, "examples", "brickwork-pro", "se-vat"),
    expectedFile: "se-brickwork-pro-vat.toml",
  },
  {
    name: "brickwork-pro/se-nonvat",
    dir: resolve(ROOT, "examples", "brickwork-pro", "se-nonvat"),
    expectedFile: "se-brickwork-pro-nonvat.toml",
  },
];

// R for one fixture, built the way report.js's --data mode builds it for SE:
// load the book, derive the scenario, run the pure JS multi-file calculator,
// then serialize through the one module both engines write R through.
function buildReport(dir) {
  const { book, lines } = loadDiyaGlData(dir);
  const scenario = diyaGlToScenario(book, lines, "se");
  const results = calculateFromDiyaGl(book, lines, "se", TAX_DATA, scenario);
  const merged = { ...scenario, ...scenario.expected };
  const checks = se.checkCompliance(results, merged, TAX_DATA, calculateExpectedTax);
  const report = buildReportDocument({ packageName: "se", engine: "js", results, productMod: se, scenario: merged, checks });
  return { report, results };
}

function expectedTotals(expectedFile) {
  return loadScenario(resolve(FIXTURES_DIR, expectedFile)).expected;
}

// Every cell key the declaration names, gathered the same way the shared
// reducer reads them, so "every key is present in R" and "no cell is absent
// from the read scope" check the declaration as it is actually used rather
// than a hand-picked subset.
function allDeclaredKeys(declaration) {
  const keys = [];
  const collect = (spec) => {
    if (!spec) return;
    if (spec.keys) keys.push(...spec.keys);
    else if (spec.key) keys.push(spec.key);
  };
  collect(declaration.turnover);
  for (const line of declaration.turnover.secondLine ?? []) keys.push(line.key);
  collect(declaration.costOfSales);
  collect(declaration.runningCosts);
  collect(declaration.tax);
  collect(declaration.assets.writtenDown);
  collect(declaration.assets.stock);
  collect(declaration.assets.debtors);
  for (const line of declaration.assets.extra ?? []) keys.push(line.key);
  for (const [key] of declaration.expenseLines) keys.push(key);
  return keys;
}

function sumShares(slices) {
  return slices.reduce((total, slice) => total + slice.share, 0);
}

describe.each(BOOKS)("SE HEADLINES — $name", ({ dir, expectedFile }) => {
  const { report, results } = buildReport(dir);
  const headlines = headlinesFromReport(report, se.HEADLINES);
  const expected = expectedTotals(expectedFile);
  const pl = results["Profit & Loss Account"];

  it("every key in the declaration is present in R", () => {
    const foundKeys = new Set(report.values.map((entry) => entry.key));
    for (const key of allDeclaredKeys(se.HEADLINES)) {
      expect(foundKeys.has(key), `missing ${key}`).toBe(true);
    }
  });

  // Every HEADLINES key is either a hub cell ("cell/Financialaccounts.xlsx!
  // <Sheet>!<Cell>", checked against standardReads()) or a leaf-file cell
  // ("cell/<file>.xlsx!<Sheet>!<Cell>", checked against
  // multiFileOptions().additionalReads), so this proves the strip reads
  // nothing outside the reconciliation's own scope.
  it("names no cell absent from standardReads() or multiFileOptions()", () => {
    const reads = se.standardReads();
    const additionalReads = se.multiFileOptions().additionalReads;
    for (const key of allDeclaredKeys(se.HEADLINES)) {
      const hubMatch = key.match(/^cell\/Financialaccounts\.xlsx!([^!]+)!(.+)$/);
      if (hubMatch) {
        const [, sheet, cell] = hubMatch;
        expect(reads[sheet] ?? [], `${key} is not in standardReads()`).toContain(cell);
        continue;
      }
      const leafMatch = key.match(/^cell\/([^!]+\.xlsx)!([^!]+)!(.+)$/);
      expect(leafMatch, `${key} is not a recognised cell key`).toBeTruthy();
      const [, file, sheet, cell] = leafMatch;
      expect(additionalReads[file]?.[sheet] ?? [], `${key} is not in multiFileOptions().additionalReads`).toContain(cell);
    }
  });

  it("turnover is the P&L's B9 and equals B5 to B8 summed", () => {
    expect(headlines.tiles.turnover.value).toBe(expected.total_sales);
    expect(headlines.tiles.turnover.value).toBeCloseTo(pl.B5 + pl.B6 + pl.B7 + pl.B8, 6);
    expect(headlines.tiles.turnover.from).toEqual(["cell/Financialaccounts.xlsx!Profit & Loss Account!B9"]);
  });

  it("turnover's second line carries grants and interest received, outside the pie", () => {
    const [grants, interest] = headlines.tiles.turnover.secondLine;
    expect(grants.label).toBe("Grants");
    expect(grants.value).toBeCloseTo(pl.B11, 6);
    expect(grants.from).toEqual(["cell/Financialaccounts.xlsx!Profit & Loss Account!B11"]);
    expect(interest.label).toBe("Interest received");
    expect(interest.value).toBeCloseTo(pl.B38, 6);
    expect(interest.from).toEqual(["cell/Financialaccounts.xlsx!Profit & Loss Account!B38"]);
  });

  it("outgoings is cost of sales plus admin expenses and equals B17 plus B35", () => {
    expect(headlines.tiles.outgoings.costOfSales.value).toBeCloseTo(pl.B17, 6);
    expect(headlines.tiles.outgoings.runningCosts.value).toBeCloseTo(pl.B35, 6);
    expect(headlines.tiles.outgoings.total.value).toBeCloseTo(pl.B17 + pl.B35, 6);
  });

  it("assets total is net book value plus stock plus cash at bank and in hand, with debtors kept out", () => {
    const { assets } = headlines.tiles;
    const cashAtBank = results["Bank.xlsx!Mar"].A2;
    const cashInHand = results["Cash.xlsx!Mar"].A2;
    expect(assets.total.value).toBeCloseTo(assets.writtenDown.value + assets.stock.value + cashAtBank + cashInHand, 6);
    expect(assets.debtors.value).toBe(results["Sales.xlsx!ClosingDebtors"].G1 ?? 0);
    expect(assets.total.from).not.toContain("cell/Sales.xlsx!ClosingDebtors!G1");
    expect(assets.total.from).toEqual(
      expect.arrayContaining([
        "cell/Fixedassets.xlsx!Schedule!K1",
        "cell/Financialaccounts.xlsx!StockControl!AB30",
        "cell/Bank.xlsx!Mar!A2",
        "cell/Cash.xlsx!Mar!A2",
      ]),
    );
  });

  it("tax is E18", () => {
    expect(headlines.tiles.tax.value).toBeCloseTo(results["Income Tax"].E18, 6);
    expect(headlines.tiles.tax.from).toEqual(["cell/Financialaccounts.xlsx!Income Tax!E18"]);
  });

  it("the four DOM hook keys carry the tile totals", () => {
    expect(headlines.keys["headline/turnover"]).toBe(headlines.tiles.turnover.value);
    expect(headlines.keys["headline/outgoings"]).toBe(headlines.tiles.outgoings.total.value);
    expect(headlines.keys["headline/assets"]).toBe(headlines.tiles.assets.total.value);
    expect(headlines.keys["headline/tax"]).toBe(headlines.tiles.tax.value);
  });

  it("the turnover pie's slices sum to turnover", () => {
    const { slices } = headlines.pies.turnover;
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    expect(total).toBeCloseTo(headlines.tiles.turnover.value, 6);
    expect(sumShares(slices)).toBeCloseTo(1, 6);
  });

  it("the outgoings pie never exceeds six slices and sums to the outgoings total", () => {
    const { slices } = headlines.pies.outgoings;
    expect(slices.length).toBeLessThanOrEqual(6);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    expect(total).toBeCloseTo(headlines.tiles.outgoings.total.value, 6);
    if (headlines.tiles.outgoings.total.value !== 0) expect(sumShares(slices)).toBeCloseTo(1, 6);
    for (const slice of slices) expect(slice.value).not.toBe(0);
  });
});

// ── The turnover-pie label rename: SE's own words, not BST's or Ltd's ──

describe("SE HEADLINES names the turnover pie's slices with the sheet's own words", () => {
  const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "advanced"));
  const { pies } = headlinesFromReport(report, se.HEADLINES);

  it("labels the running-costs slice Admin expenses", () => {
    const labels = pies.turnover.slices.map((slice) => slice.label);
    expect(labels).toContain("Admin expenses");
    expect(labels).not.toContain("Running costs");
  });
});

// ── Breakability: corrupting one declared cell moves only the tile or
// slice that traces to it, nothing else ──

describe("SE HEADLINES is breakable: corrupting one declared cell moves only its own tile or slice", () => {
  function withValue(report, key, value) {
    return {
      ...report,
      values: report.values.map((entry) => (entry.key === key ? { ...entry, value: String(value) } : entry)),
    };
  }

  function cellValue(report, key) {
    return Number(report.values.find((entry) => entry.key === key).value);
  }

  it("corrupting B24 (General Admin, folded into Other) moves only its outgoings slice", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "advanced"));
    const key = "cell/Financialaccounts.xlsx!Profit & Loss Account!B24";
    const before = headlinesFromReport(report, se.HEADLINES);
    const originalValue = cellValue(report, key);
    const corrupted = withValue(report, key, originalValue + 1000);
    const after = headlinesFromReport(corrupted, se.HEADLINES);

    // Every tile is untouched: B24 feeds no tile total, only the pie's own
    // per-line reads.
    expect(after.tiles.turnover).toEqual(before.tiles.turnover);
    expect(after.tiles.outgoings).toEqual(before.tiles.outgoings);
    expect(after.tiles.tax).toEqual(before.tiles.tax);
    expect(after.tiles.assets).toEqual(before.tiles.assets);
    expect(after.pies.turnover).toEqual(before.pies.turnover);

    const beforeOther = before.pies.outgoings.slices.find((slice) => slice.label === "Other");
    const afterOther = after.pies.outgoings.slices.find((slice) => slice.label === "Other");
    expect(beforeOther.from).toContain(key);
    expect(afterOther.value).toBeCloseTo(beforeOther.value + 1000, 6);

    for (const label of before.pies.outgoings.slices.map((slice) => slice.label).filter((label) => label !== "Other")) {
      const b = before.pies.outgoings.slices.find((slice) => slice.label === label);
      const a = after.pies.outgoings.slices.find((slice) => slice.label === label);
      expect(a).toEqual(b);
    }
  });

  it("corrupting Schedule K1 moves only the assets tile", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "advanced"));
    const key = "cell/Fixedassets.xlsx!Schedule!K1";
    const before = headlinesFromReport(report, se.HEADLINES);
    const corrupted = withValue(report, key, 0);
    const after = headlinesFromReport(corrupted, se.HEADLINES);

    expect(after.tiles.turnover).toEqual(before.tiles.turnover);
    expect(after.tiles.outgoings).toEqual(before.tiles.outgoings);
    expect(after.tiles.tax).toEqual(before.tiles.tax);
    expect(after.pies.turnover).toEqual(before.pies.turnover);
    expect(after.pies.outgoings).toEqual(before.pies.outgoings);

    expect(after.tiles.assets.writtenDown.value).toBe(0);
    expect(after.tiles.assets.writtenDown.value).not.toBe(before.tiles.assets.writtenDown.value);
    expect(after.tiles.assets.total.value).toBeCloseTo(before.tiles.assets.total.value - before.tiles.assets.writtenDown.value, 6);
    expect(after.tiles.assets.stock).toEqual(before.tiles.assets.stock);
    expect(after.tiles.assets.debtors).toEqual(before.tiles.assets.debtors);
  });
});

// ── The missing-key error ──

describe("SE HEADLINES — a required key with no value in R is an error naming the key", () => {
  it("throws naming the missing key rather than defaulting to zero", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "precision-code-ltd", "advanced"));
    const withoutTurnover = {
      ...report,
      values: report.values.filter((entry) => entry.key !== "cell/Financialaccounts.xlsx!Profit & Loss Account!B9"),
    };
    expect(() => headlinesFromReport(withoutTurnover, se.HEADLINES)).toThrow("cell/Financialaccounts.xlsx!Profit & Loss Account!B9");
  });
});
