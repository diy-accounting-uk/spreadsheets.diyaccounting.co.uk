// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The Basic Sole Trader view manifest the books page mounts
// (web/.../books/products/bst.js), proved against the product module it
// derives from and the calculator's own annual cells over the three diya-gl
// BST fixtures. The manifest is a classic script that assigns one global, so
// it is imported for its side effect and read back off globalThis.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario, resolveBstPurchaseCodeMap } from "../lib/diya-gl-loader.js";
import { BST_SALES_ACCOUNTS } from "../lib/scenario-extractor.js";
import { calculateBstResults } from "../lib/calculators/bst.js";
import * as bst from "../products/bst.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const MANIFEST_FILE = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "books", "products", "bst.js");
const taxData = parseTOML(readFileSync(resolve(ROOT, "app", "data", "se-2025-2026.toml"), "utf8"));

const globalsBefore = new Set(Object.keys(globalThis));
await import(MANIFEST_FILE);
const globalsAfter = Object.keys(globalThis).filter((key) => !globalsBefore.has(key));
const manifest = globalThis.DiyaGlProducts.bst;

const engine = { BST_SALES_ACCOUNTS, resolveBstPurchaseCodeMap };

const BOOKS = [
  { name: "precision-code-ltd/bst", dir: resolve(ROOT, "examples", "precision-code-ltd", "bst"), mileageRoute: false },
  { name: "sp-sixty-driving/bst", dir: resolve(ROOT, "examples", "sp-sixty-driving", "bst"), mileageRoute: true },
  { name: "brickwork-pro/bst-nonvat", dir: resolve(ROOT, "examples", "brickwork-pro", "bst-nonvat"), mileageRoute: false },
];

function calculated(dir) {
  const { book, lines } = loadDiyaGlData(dir);
  const scenario = diyaGlToScenario(book, lines, "bst");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateBstResults(book, lines, taxData, merged);
  return { book, lines, results };
}

function ctxFor(fixture) {
  return { engine, productMod: bst, manifest, taxData, taxYearName: "se-2025-2026", ...fixture };
}

const PL_CELLS_BY_KEY = Object.fromEntries(manifest.months.categories(bst).map((c) => [c.key, c.cell]));

describe("the BST view manifest", () => {
  it("defines DiyaGlProducts.bst and nothing else on the global", () => {
    expect(globalsAfter).toEqual(["DiyaGlProducts"]);
    expect(Object.keys(globalThis.DiyaGlProducts)).toEqual(["bst"]);
    expect(manifest.id).toBe("bst");
    expect(manifest.schemaName).toBe("BasicSoleTrader");
  });

  it("lists the ten view ids the page had, in order", () => {
    expect(manifest.views.map((v) => v.id)).toEqual([
      "home",
      "year",
      "profit-loss",
      "stock",
      "debtors-creditors",
      "fixed-assets",
      "income-tax",
      "sa103s",
      "business-details",
      "admin",
    ]);
    for (const view of manifest.views) {
      expect(view.shared || typeof view.render === "function", `view ${view.id} has a renderer`).toBeTruthy();
    }
  });

  it("categories() names the seventeen Profit & Loss cells from C4 to C24 in CELL_MAP order, with three computed", () => {
    const categories = manifest.months.categories(bst);
    expect(categories).toHaveLength(17);
    expect(categories[0]).toMatchObject({ key: "sales", label: "Sales Turnover", cell: "C4", computed: false });
    expect(categories[categories.length - 1]).toMatchObject({ key: "netProfit", label: "Net Profit", cell: "C24", computed: true });
    expect(categories.filter((c) => c.computed).map((c) => c.key)).toEqual(["grossProfit", "totalExpenses", "netProfit"]);

    const plSheet = categories[0].sheet;
    const cellMapOrder = bst.CELL_MAP.filter((row) => row[0] === plSheet && row[4] === "Profit & Loss Account").map((row) => row[1]);
    expect(cellMapOrder.slice(0, 17)).toEqual(categories.map((c) => c.cell));
    expect(categories.find((c) => c.key === "costOfSales").label).toBe("Cost of Sales");
  });

  it("monthlyCell() names the Monthly Sales cell for sales alone", () => {
    expect(manifest.yearTable.monthlyCell("Apr", bst, "sales")).toEqual(["Profit & Loss Acc", "D4"]);
    expect(manifest.yearTable.monthlyCell("Mar", bst, "sales")).toEqual(["Profit & Loss Acc", "O4"]);
    expect(manifest.yearTable.monthlyCell("Apr", bst, "netProfit")).toBeNull();
    expect(manifest.yearTable.monthlyCell("Apr", bst, "costOfSalesComposite")).toBeNull();
  });
});

describe.each(BOOKS)("classify() sums to the engine's own annual cells — $name", ({ dir, mileageRoute }) => {
  const fixture = calculated(dir);
  const ctx = ctxFor(fixture);
  const categories = manifest.months.categories(bst);
  const row = Object.fromEntries(categories.map((c) => [c.key, 0]));
  row.capex = 0;
  for (const line of fixture.lines) {
    const placed = manifest.months.classify(line, fixture.book, ctx);
    if (placed.key !== null) row[placed.key] += line.amount;
  }
  manifest.months.closeYear(row, fixture.book);
  manifest.months.derive(row, null, ctx);
  const pl = fixture.results["Profit & Loss Acc"];

  it("every line reaches an account", () => {
    const unposted = fixture.lines.filter((line) => manifest.months.classify(line, fixture.book, ctx).key === null);
    expect(unposted).toEqual([]);
  });

  // The calculator rounds each category to whole pounds, so the lines and
  // the cell agree to half a pound. On the mileage route the sheet's motor
  // expenses are the motoring lines that bought something plus the mileage
  // claim the analysis sheet carries; a mileage-log line buys nothing, so
  // its amount is left out of that cell while the month rows still show it.
  it.each(categories.filter((c) => !c.computed).map((c) => [c.key, c.cell]))("%s adds up to %s", (key, cell) => {
    if (key === "motorExpenses" && mileageRoute) {
      const motoringBought = fixture.lines
        .filter(
          (line) => manifest.months.classify(line, fixture.book, ctx).key === "motorExpenses" && line.measurableUnitOfMeasure !== "miles",
        )
        .reduce((sum, line) => sum + line.amount, 0);
      expect(pl[cell]).toBe(Math.round(motoringBought + fixture.results.PurchasesMar.A1));
      return;
    }
    expect(Math.abs(row[key] - pl[cell]), `${key}: lines ${row[key]} against ${cell} ${pl[cell]}`).toBeLessThanOrEqual(0.5);
  });

  it("capex adds up to the schedule's total cost", () => {
    expect(row.capex).toBe(fixture.results["Fixed Assets"].E1);
  });

  it("derive() fills the three computed keys from the additive ones", () => {
    expect(row.grossProfit).toBeCloseTo(row.sales - row.costOfSales - row.directCosts, 6);
    expect(row.netProfit).toBeCloseTo(row.grossProfit - row.totalExpenses, 6);
  });
});

describe("the snapshot's product half", () => {
  const fixture = calculated(BOOKS[0].dir);
  const snapshot = manifest.snapshot(ctxFor(fixture));
  const cellsOf = (section, sheet) => bst.CELL_MAP.filter((row) => row[4] === section && row[0] === sheet).map((row) => row[1]);

  it("the annual row reads every category cell and capex", () => {
    for (const [key, cell] of Object.entries(PL_CELLS_BY_KEY)) {
      expect(snapshot.annual[key], key).toBe(fixture.results["Profit & Loss Acc"][cell] || 0);
    }
    expect(snapshot.annual.capex).toBe(fixture.results["Fixed Assets"].E1);
    expect(snapshot.annual.netIncomeAfterTax).toBe(fixture.results["Profit & Loss Acc"].C35 || 0);
  });

  it("the income tax layout names every Income Tax CELL_MAP cell exactly once", () => {
    const cells = snapshot.incomeTax.cells;
    const named = [
      cells.profitFromSelfEmployment,
      cells.personalAllowance,
      cells.taxableIncome,
      ...cells.bands.flatMap((band) => [band.rate, band.ceiling, band.tax]).filter(Boolean),
      cells.totalIncomeTax,
      cells.cisDeducted,
      cells.niClass4Lower,
      cells.niClass4Upper,
      cells.totalTaxAndNi,
    ];
    expect([...named].sort()).toEqual([...cellsOf("Income Tax Calculation", bst.TAX_SHEET)].sort());
    expect(new Set(named).size).toBe(named.length);
  });

  it("the Admin rates are the Admin CELL_MAP rows, with the four mileage cells printed as miles and pence", () => {
    const adminCells = cellsOf("Admin (Generator Injected)", "Admin");
    expect(snapshot.admin.rates.map((r) => r.cell)).toEqual(adminCells);
    const overridden = snapshot.admin.rates.filter((r) => r.format === "number" || r.format === "pence");
    expect(overridden.map((r) => [r.cell, r.format])).toEqual([
      ["F21", "number"],
      ["G21", "pence"],
      ["F22", "number"],
      ["G22", "pence"],
    ]);
    expect(snapshot.admin.rates[0]).toMatchObject({
      label: "Personal Allowance",
      value: taxData.income_tax.personal_allowance,
      format: "currency",
    });
    expect(snapshot.admin.year).toBe(taxData.tax_year.label);
  });

  it("the ledger sides split the Debtors & Creditors rows by column, debtors being the trade debtors column", () => {
    expect(snapshot.debtors.openingCell).toBe("C3");
    expect(snapshot.debtors.monthlyCells).toHaveLength(12);
    expect(snapshot.debtors.totalCell).toBe("C29");
    expect(snapshot.creditors.openingCell).toBe("F3");
    expect(snapshot.creditors.totalCell).toBe("F29");
    expect(snapshot.debtors.openingLabel).toBe("Owed by customers at start of year");
    expect(snapshot.debtors.monthlyLabel).toBe("Sales not yet received");
    expect(snapshot.debtors.totalLabel).toBe("Amount owed by customers");
    expect(snapshot.creditors.monthlyLabel).toBe("Purchases still to be paid");
  });
});
