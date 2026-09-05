// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Proves headlinesFromReport() against Taxi's own HEADLINES declaration over
// the three diya-gl Taxi fixtures plus autumn-start-cabs, built the same way
// app/bin/report.js's --data mode builds R: no LibreOffice, no xlsx, the JS
// calculator straight into buildReportDocument().

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateTaxiResults } from "../lib/calculators/taxi.js";
import * as taxi from "../products/taxi.js";
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
  { name: "basic-taxi-driver/taxi", dir: resolve(ROOT, "examples", "basic-taxi-driver", "taxi"), expectedFile: "taxi-scenario-basic.toml" },
  {
    name: "kestrel-executive-cars/taxi",
    dir: resolve(ROOT, "examples", "kestrel-executive-cars", "taxi"),
    expectedFile: "taxi-scenario-kestrel.toml",
  },
  {
    name: "sp-sixty-driving/taxi",
    dir: resolve(ROOT, "examples", "sp-sixty-driving", "taxi"),
    expectedFile: "taxi-scenario-sp-sixty.toml",
  },
  {
    name: "autumn-start-cabs/taxi",
    dir: resolve(ROOT, "examples", "autumn-start-cabs", "taxi"),
    expectedFile: "taxi-scenario-autumn-start.toml",
  },
];

// R for one fixture, built the way report.js's --data mode builds it: load
// the book, derive the scenario, run the pure JS calculator, then serialize
// through the one module both engines write R through.
function buildReport(dir) {
  const { book, lines } = loadDiyaGlData(dir);
  const scenario = diyaGlToScenario(book, lines, "taxi");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateTaxiResults(book, lines, taxData, merged);
  const checks = taxi.checkCompliance(results, merged, taxData, calculateExpectedTax);
  const report = buildReportDocument({ packageName: "taxi", engine: "js", results, productMod: taxi, scenario: merged, checks });
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

// Every "cell/..." key a declaration names, wherever it sits -- a plain
// `{key}`/`{keys}` spec, a `pieLines` pair, or a `vehicle` field.
function declaredCellKeys(declaration) {
  const keys = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
    } else if (node && typeof node === "object") {
      for (const value of Object.values(node)) visit(value);
    } else if (typeof node === "string" && node.startsWith("cell/")) {
      keys.push(node);
    }
  };
  visit(declaration);
  return keys;
}

describe.each(BOOKS)("headlinesFromReport — Taxi — $name", ({ dir, expectedFile }) => {
  const { report, results } = buildReport(dir);
  const headlines = headlinesFromReport(report, taxi.HEADLINES);
  const expected = expectedTotals(expectedFile);
  const pl = results["Profit & Loss Acc"];

  it("turnover matches the fixture's own expected total_sales", () => {
    expect(headlines.tiles.turnover.value).toBe(expected.total_sales);
    expect(headlines.tiles.turnover.from).toEqual(["cell/Profit & Loss Acc!B5"]);
  });

  it("outgoings total is the vehicle-cost total plus the general-expense total read from R", () => {
    expect(headlines.tiles.outgoings.total.value).toBeCloseTo(pl.B12 + pl.B22, 6);
    expect(headlines.tiles.outgoings.costOfSales.value).toBeCloseTo(pl.B12, 6);
    expect(headlines.tiles.outgoings.runningCosts.value).toBeCloseTo(pl.B22, 6);
  });

  it("assets is the written-down value alone, present or missing exactly as Fixed Assets!K1 is", () => {
    const k1 = results["Fixed Assets"]?.K1;
    if (k1 === undefined) {
      expect(headlines.tiles.assets.writtenDown).toEqual({ value: 0, from: [], missing: true });
    } else {
      expect(headlines.tiles.assets.writtenDown.value).toBeCloseTo(k1, 6);
      expect(headlines.tiles.assets.writtenDown.missing).toBeUndefined();
    }
    // No stock, no debtors: the total is the written-down value alone.
    expect(headlines.tiles.assets.total.value).toBeCloseTo(headlines.tiles.assets.writtenDown.value, 6);
    expect(headlines.tiles.assets.stock).toEqual({ value: 0, from: [], missing: true });
    expect(headlines.tiles.assets.debtors).toEqual({ value: 0, from: [], missing: true });
  });

  it("tax matches the sheet's total tax and NI", () => {
    expect(headlines.tiles.tax.value).toBeCloseTo(results[taxi.TAX_SHEET].E17, 6);
  });

  it("the four DOM hook keys carry the tile totals", () => {
    expect(headlines.keys["headline/turnover"]).toBe(headlines.tiles.turnover.value);
    expect(headlines.keys["headline/outgoings"]).toBe(headlines.tiles.outgoings.total.value);
    expect(headlines.keys["headline/assets"]).toBe(headlines.tiles.assets.total.value);
    expect(headlines.keys["headline/tax"]).toBe(headlines.tiles.tax.value);
  });

  it("the outgoings pie's slices sum to outgoings, never more than six, and their shares sum to 1", () => {
    const { slices } = headlines.pies.outgoings;
    expect(slices.length).toBeLessThanOrEqual(6);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    expect(total).toBeCloseTo(headlines.tiles.outgoings.total.value, 6);
    expect(sumShares(slices)).toBeCloseTo(1, 9);
    for (const slice of slices) expect(slice.value).not.toBe(0);
  });

  it("the outgoings pie never shows one combined Cost of sales slice, only the sheet's own vehicle and expense lines", () => {
    const labels = headlines.pies.outgoings.slices.map((slice) => slice.label);
    expect(labels).not.toContain("Cost of sales");
  });

  it("the turnover pie is a pie, with the declared labels on the cost-of-sales, running-costs and tax slices", () => {
    expect(headlines.pies.turnover.mode).toBe("pie");
    const byLabel = Object.fromEntries(headlines.pies.turnover.slices.map((slice) => [slice.label, slice]));
    expect(byLabel["vehicle costs"].value).toBeCloseTo(pl.B12, 6);
    expect(byLabel["running the business"].value).toBeCloseTo(pl.B22, 6);
    expect(byLabel["income tax and Class 4 NI"].value).toBeCloseTo(results[taxi.TAX_SHEET].E17, 6);
  });
});

// ── The vehicle tile: present only where the book keeps a mileage log ──

describe("headlinesFromReport — Taxi's vehicle tile", () => {
  it("exists on sp-sixty-driving, on the mileage route, with the sheet's own comparison figures", () => {
    const { report, results } = buildReport(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    const headlines = headlinesFromReport(report, taxi.HEADLINES);
    const vehicle = headlines.tiles.vehicle;
    const pl = results["Profit & Loss Acc"];

    expect(vehicle).toBeDefined();
    expect(vehicle.route).toBe("mileage");
    expect(vehicle.miles.value).toBe(results.PurchasesMar.A1);
    expect(vehicle.allowance.value).toBeCloseTo(results.PurchasesMar.A2, 2);
    expect(vehicle.running.value).toBeCloseTo(results.PurchasesMar.I2, 2);
    expect(vehicle.compared.value).toBeCloseTo(pl.J1, 2);
    expect(vehicle.charged.value).toBeCloseTo(pl.B12, 2);
    expect(headlines.keys["headline/vehicle-costs"]).toBe(vehicle.charged.value);
  });

  // basic-taxi-driver, kestrel-executive-cars and autumn-start-cabs carry no
  // mileage-tagged line at all (only sp-sixty-driving does), so their
  // PurchasesMar!A1 reads 0 and the tile has nothing to compare.
  for (const name of ["basic-taxi-driver", "kestrel-executive-cars", "autumn-start-cabs"]) {
    it(`is absent on ${name}, which keeps no mileage log`, () => {
      const { report } = buildReport(resolve(ROOT, "examples", name, "taxi"));
      const headlines = headlinesFromReport(report, taxi.HEADLINES);
      expect(headlines.tiles).not.toHaveProperty("vehicle");
      expect(headlines.keys).not.toHaveProperty("headline/vehicle-costs");
    });
  }

  // No fixture among the four takes the actual-costs route while also
  // keeping a mileage log -- sp-sixty-driving is the only one with any
  // miles at all, and it takes the mileage route. The actual-costs branch
  // is proved instead by removing R's own route entry, exactly as it is
  // absent on a book that genuinely takes that route (the calculator never
  // writes Profit & Loss Acc!C1 unless the mileage route is taken).
  it("reads the actual-costs route when R carries no route entry", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    const withoutRoute = { ...report, values: report.values.filter((entry) => entry.key !== "cell/Profit & Loss Acc!C1") };
    const headlines = headlinesFromReport(withoutRoute, taxi.HEADLINES);
    expect(headlines.tiles.vehicle.route).toBe("actual");
    expect(headlines.tiles.vehicle.miles.value).toBe(21680);
  });
});

// ── Breakability: one corrupted R value moves only the slice that traces to it ──

describe("headlinesFromReport is breakable: corrupting one R value moves only the outgoings-pie slice that traces to it", () => {
  it("corrupting the general admin line moves only its own outgoings-pie slice", () => {
    const { report } = buildReport(resolve(ROOT, "examples", "basic-taxi-driver", "taxi"));
    const before = headlinesFromReport(report, taxi.HEADLINES);
    const corrupted = {
      ...report,
      values: report.values.map((entry) => (entry.key === "cell/Profit & Loss Acc!B16" ? { ...entry, value: "999999" } : entry)),
    };
    const after = headlinesFromReport(corrupted, taxi.HEADLINES);

    expect(after.tiles.turnover).toEqual(before.tiles.turnover);
    expect(after.tiles.assets).toEqual(before.tiles.assets);
    expect(after.tiles.tax).toEqual(before.tiles.tax);
    expect(after.pies.turnover).toEqual(before.pies.turnover);
    expect(after.pies.outgoings).not.toEqual(before.pies.outgoings);
    expect(after.pies.outgoings.slices[0]).toMatchObject({ label: "General admin", value: 999999 });
  });
});

// ── The declaration reads only what CELL_MAP already reads ──

describe("headlinesFromReport — Taxi's declaration carries no key CELL_MAP does not read", () => {
  it("every declared key's sheet!cell is in standardReads()", () => {
    const reads = taxi.standardReads();
    for (const key of declaredCellKeys(taxi.HEADLINES)) {
      const [sheet, cell] = key.replace(/^cell\//, "").split("!");
      expect(reads[sheet], `${sheet} has no reads at all`).toBeDefined();
      expect(reads[sheet], `${sheet} does not read ${cell}`).toContain(cell);
    }
  });
});
