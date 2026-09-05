// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The Taxi Driver view manifest the books page mounts
// (web/.../books/products/taxi.js), proved against the product module it
// derives from, the calculator's own cells, and the Sales grid the workbook
// is written from. The manifest is a classic script that assigns one global,
// so it is imported for its side effect and read back off globalThis.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { TAXI_PURCHASE_CODE_MAP, generateTaxYearWeeks, groupWeeksIntoMonths, calculateExpectedTax } from "../lib/books-engine.js";
import { calculateTaxiResults } from "../lib/calculators/taxi.js";
import * as taxi from "../products/taxi.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const MANIFEST_FILE = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "books", "products", "taxi.js");
const taxData = parseTOML(readFileSync(resolve(ROOT, "app", "data", "se-2025-2026.toml"), "utf8"));

const globalsBefore = new Set(Object.keys(globalThis));
await import(MANIFEST_FILE);
const globalsAfter = Object.keys(globalThis).filter((key) => !globalsBefore.has(key));
const manifest = globalThis.DiyaGlProducts.taxi;

const engine = { TAXI_PURCHASE_CODE_MAP, calculateExpectedTax };

const BOOKS = [
  { name: "basic-taxi-driver", dir: "basic-taxi-driver" },
  { name: "sp-sixty-driving", dir: "sp-sixty-driving" },
  { name: "kestrel-executive-cars", dir: "kestrel-executive-cars" },
  { name: "autumn-start-cabs", dir: "autumn-start-cabs" },
];

function calculated(dir) {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", dir, "taxi"));
  const scenario = diyaGlToScenario(book, lines, "taxi");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateTaxiResults(book, lines, taxData, merged);
  return { book, lines, results };
}

// The ctx assembleSnapshot builds, with the months build() has just
// returned — the same order data.js calls them in.
function ctxFor(fixture) {
  const ctx = { engine, productMod: taxi, manifest, taxData, taxYearName: "se-2025-2026", ...fixture };
  ctx.months = manifest.months.build(fixture.book);
  return ctx;
}

const CATEGORIES = manifest.months.categories(taxi);
const PL_CELLS_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.cell]));

describe("the Taxi view manifest", () => {
  it("defines DiyaGlProducts.taxi and nothing else on the global", () => {
    expect(globalsAfter).toEqual(["DiyaGlProducts"]);
    expect(Object.keys(globalThis.DiyaGlProducts)).toEqual(["taxi"]);
    expect(manifest.id).toBe("taxi");
    expect(manifest.schemaName).toBe("TaxiDriver");
  });

  it("lists the ten view ids in the plan's order, and none of BST's three", () => {
    expect(manifest.views.map((v) => v.id)).toEqual([
      "home",
      "year",
      "profit-loss",
      "fixed-assets",
      "tax-computation",
      "sa103s",
      "quarterly",
      "forecast",
      "business-details",
      "admin",
    ]);
    for (const absent of ["stock", "debtors-creditors", "income-tax"]) {
      expect(
        manifest.views.some((v) => v.id === absent),
        absent,
      ).toBe(false);
    }
    for (const view of manifest.views) {
      expect(view.shared || typeof view.render === "function", `view ${view.id} has a renderer`).toBeTruthy();
    }
    // The sheet each view names comes from the product module wherever the
    // module has a name for it.
    const sheetsOf = (id) => {
      const view = manifest.views.find((v) => v.id === id);
      return typeof view.sheets === "function" ? view.sheets(taxi) : view.sheets;
    };
    expect(sheetsOf("profit-loss")).toBe("Profit & Loss Acc");
    expect(sheetsOf("tax-computation")).toBe(taxi.TAX_SHEET);
    expect(sheetsOf("forecast")).toBe(taxi.FORECAST_SHEET);
  });

  it("categories() names the twenty P&L cells B5 to B24 in CELL_MAP order, six computed", () => {
    expect(CATEGORIES).toHaveLength(20);
    expect(CATEGORIES[0]).toMatchObject({ key: "sales", label: "Takings", sheet: "Profit & Loss Acc", cell: "B5", computed: false });
    expect(CATEGORIES[19]).toMatchObject({ key: "otherIncome", label: "Other income", cell: "B24", computed: false });
    expect(CATEGORIES.filter((c) => c.computed).map((c) => c.key)).toEqual([
      "capitalAllowances",
      "mileageAllowance",
      "costOfSales",
      "grossProfit",
      "totalExpenses",
      "netProfit",
    ]);
    const cellMapOrder = taxi.CELL_MAP.filter((row) => row[4] === "Profit & Loss Account").map((row) => row[1]);
    expect(cellMapOrder.slice(0, 20)).toEqual(CATEGORIES.map((c) => c.cell));
    expect(CATEGORIES.find((c) => c.key === "repairs").label).toBe("Repairs & Servicing");
  });

  it("monthlyCell() keys the four monthly rows and nothing else", () => {
    expect(manifest.yearTable.monthlyCell("Apr", taxi, "sales")).toEqual(["Profit & Loss Acc", "C5"]);
    expect(manifest.yearTable.monthlyCell("Mar", taxi, "otherIncome")).toEqual(["Profit & Loss Acc", "N24"]);
    expect(manifest.yearTable.monthlyCell("May", taxi, "costOfSales")).toEqual(["Profit & Loss Acc", "D12"]);
    expect(manifest.yearTable.monthlyCell("Dec", taxi, "totalExpenses")).toEqual(["Profit & Loss Acc", "K22"]);
    for (const key of CATEGORIES.map((c) => c.key).filter((k) => !["sales", "otherIncome", "costOfSales", "totalExpenses"].includes(k))) {
      expect(manifest.yearTable.monthlyCell("Apr", taxi, key), key).toBeNull();
    }
  });

  it("every monthly cell it keys is a CELL_MAP row, so the year table's month figures can drift", () => {
    const named = new Set(taxi.CELL_MAP.map((row) => `${row[0]}!${row[1]}`));
    for (const label of Object.keys({ Apr: 1, May: 1, Jun: 1, Jul: 1, Aug: 1, Sep: 1, Oct: 1, Nov: 1, Dec: 1, Jan: 1, Feb: 1, Mar: 1 })) {
      for (const key of ["sales", "otherIncome", "costOfSales", "totalExpenses"]) {
        const [sheet, cell] = manifest.yearTable.monthlyCell(label, taxi, key);
        expect(named.has(`${sheet}!${cell}`), `${sheet}!${cell}`).toBe(true);
      }
    }
  });
});

// ============================== the Sales tab grid ==============================

describe("build() lays the twelve tab months out as the workbook does", () => {
  const isoWeeks = (startYear) => generateTaxYearWeeks(startYear).map((week) => week.map((d) => d.toISOString().slice(0, 10)));

  it.each([2025, 2026, 2027, 2030])("the manifest's own week walk matches the engine's for %i", (startYear) => {
    expect(manifest.internals.taxYearWeeks(startYear)).toEqual(isoWeeks(startYear));
  });

  it.each([2025, 2027])("every tab holds the weeks groupWeeksIntoMonths gives it, for %i", (startYear) => {
    const grouped = groupWeeksIntoMonths(generateTaxYearWeeks(startYear));
    const months = manifest.months.build({ documentInfo: { periodCoveredStart: `${startYear}-04-06` } });
    for (const month of months) {
      const engineWeeks = grouped[month.label.toLowerCase()];
      if (!engineWeeks.length) {
        expect(month.start, month.label).toBeNull();
        continue;
      }
      expect(month.start, month.label).toBe(engineWeeks[0][0].toISOString().slice(0, 10));
      const lastWeek = engineWeeks[engineWeeks.length - 1];
      expect(month.end, month.label).toBe(lastWeek[lastWeek.length - 1].toISOString().slice(0, 10));
    }
  });

  it("the 2025-26 year runs 2025-04 to 2026-03, May captioned from Mon 28 Apr", () => {
    const months = manifest.months.build({ documentInfo: { periodCoveredStart: "2025-04-06" } });
    expect(months.map((m) => m.key)).toEqual([
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(months.map((m) => m.label)).toEqual(["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]);
    expect(months[0]).toMatchObject({ sheet: "SalesApr", start: "2025-04-06", caption: null });
    expect(months[1]).toMatchObject({ sheet: "SalesMay", start: "2025-04-28", caption: "from Mon 28 Apr" });
    // June's first week ends Sunday 1 June, so that tab opens in May too.
    expect(months[2]).toMatchObject({ start: "2025-05-26", caption: "from Mon 26 May" });
    // The three tabs of 2025-26 whose first week starts inside their own month.
    expect(months.filter((m) => m.caption === null).map((m) => m.label)).toEqual(["Apr", "Sep", "Dec"]);
    expect(months[11].end).toBe("2026-04-05");
  });

  it("a year starting on a Tuesday opens with a six-day week and no April caption", () => {
    const months = manifest.months.build({ documentInfo: { periodCoveredStart: "2027-04-06" } });
    expect(new Date(`${months[0].start}T00:00:00Z`).getUTCDay()).toBe(2);
    expect(manifest.internals.taxYearWeeks(2027)[0]).toHaveLength(6);
    expect(months[0]).toMatchObject({ start: "2027-04-06", caption: null });
  });
});

// build() sets the grid keyOf reads, so every case here rebuilds it: the
// page only ever holds one book, and data.js always builds before it places
// a line.
describe("keyOf() puts a line where the writer puts it", () => {
  const rebuild = () => manifest.months.build({ documentInfo: { periodCoveredStart: "2025-04-06" } });
  const sale = (postingDate) => {
    rebuild();
    return manifest.months.keyOf({ sourceJournalID: "sales", postingDate });
  };
  const purchase = (postingDate) => {
    rebuild();
    return manifest.months.keyOf({ sourceJournalID: "purchases", postingDate });
  };

  it("a fare in the week ending Sunday 4 May belongs to the May tab", () => {
    expect(sale("2025-04-28")).toBe("2025-05");
    expect(sale("2025-04-27")).toBe("2025-04");
  });

  it("the year's last day belongs to the March tab", () => {
    expect(sale("2026-04-05")).toBe("2026-03");
  });

  it("a purchase keeps its plain calendar month, so 3 April 2026 is still PurchasesApr", () => {
    expect(purchase("2026-04-03")).toBe("2025-04");
    expect(purchase("2025-12-31")).toBe("2025-12");
    expect(purchase("2026-01-01")).toBe("2026-01");
  });

  it("a fare the grid has no row for belongs to no month", () => {
    expect(sale("2025-04-02")).toBeNull();
    expect(sale("2026-04-07")).toBeNull();
  });
});

// ============================== the month rows ==============================

describe.each(BOOKS)("classify() and derive() agree with the engine's own cells — $name", ({ dir }) => {
  const fixture = calculated(dir);
  const ctx = ctxFor(fixture);
  const pl = fixture.results["Profit & Loss Acc"];

  const yearRow = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));
  yearRow.capex = 0;
  const monthRows = {};
  for (const month of ctx.months) {
    monthRows[month.key] = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));
    monthRows[month.key].capex = 0;
  }
  for (const line of fixture.lines) {
    const placed = manifest.months.classify(line, fixture.book, ctx);
    if (placed.key === null) continue;
    yearRow[placed.key] += line.amount;
    const monthKey = manifest.months.keyOf(line);
    if (monthRows[monthKey]) monthRows[monthKey][placed.key] += line.amount;
  }
  for (const month of ctx.months) manifest.months.derive(monthRows[month.key], month.key, ctx);

  it("every line reaches an account", () => {
    const unposted = fixture.lines.filter((line) => manifest.months.classify(line, fixture.book, ctx).key === null);
    expect(unposted).toEqual([]);
  });

  // The sheet rounds each general-expense row up to whole pounds, so the
  // lines are at most a pound under the cell they sum into.
  it.each([
    "employeeCosts",
    "premisesCosts",
    "generalAdmin",
    "advertising",
    "legalProfessional",
    "interestFinance",
    "bankCharges",
    "otherExpenses",
  ])("%s sums to within a pound below its annual cell", (key) => {
    const cell = PL_CELLS_BY_KEY[key];
    const delta = pl[cell] - yearRow[key];
    expect(delta, `${key}: lines ${yearRow[key]} against ${cell} ${pl[cell]}`).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThan(1);
  });

  // A mileage-log purchase buys nothing -- its whole expense is the claim
  // -- so it never reaches the running-cost total the analysis sheet keeps.
  it("the four vehicle keys sum to the year's running costs to the penny", () => {
    const spent = fixture.lines
      .filter((line) => {
        const key = manifest.months.classify(line, fixture.book, ctx).key;
        return ["fuel", "carHire", "repairs", "roadTaxInsurance"].includes(key) && line.measurableUnitOfMeasure !== "miles";
      })
      .reduce((sum, line) => sum + line.amount, 0);
    expect(spent).toBeCloseTo(fixture.results.PurchasesMar.I2, 2);
  });

  it("capex sums to the year's capitalised vehicle purchases", () => {
    expect(yearRow.capex).toBeCloseTo(fixture.results.PurchasesMar.T1, 2);
  });

  it.each(["sales", "costOfSales", "totalExpenses", "otherIncome"])("every month row's %s is the sheet's own monthly cell", (key) => {
    for (const month of ctx.months) {
      const [, cell] = manifest.yearTable.monthlyCell(month.label, taxi, key);
      expect(monthRows[month.key][key], `${month.key} ${key} ${cell}`).toBe(pl[cell] || 0);
    }
  });

  it("derive() computes gross and net profit from the month's own four figures, and zeroes the two year allowances", () => {
    for (const month of ctx.months) {
      const row = monthRows[month.key];
      expect(row.grossProfit).toBeCloseTo(row.sales - row.costOfSales, 6);
      expect(row.netProfit).toBeCloseTo(row.grossProfit - row.totalExpenses, 6);
      expect(row.capitalAllowances).toBe(0);
      expect(row.mileageAllowance).toBe(0);
      expect(row.directCosts).toBe(0);
    }
  });
});

describe("a corrupted code letter names its own key", () => {
  const fixture = calculated("basic-taxi-driver");
  const ctx = ctxFor(fixture);
  // The engine's own map with fuel moved onto repairs: the fuel key empties
  // and repairs takes both, and nothing else moves.
  const brokenCtx = { ...ctx, engine: { ...engine, TAXI_PURCHASE_CODE_MAP: { ...TAXI_PURCHASE_CODE_MAP, 5100: "r" } } };
  const sumsFor = (usedCtx) => {
    const row = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));
    for (const line of fixture.lines) {
      const placed = manifest.months.classify(line, fixture.book, usedCtx);
      if (placed.key !== null && placed.key !== "capex") row[placed.key] += line.amount;
    }
    return row;
  };

  it("moves fuel onto repairs and leaves every other key where it was", () => {
    const before = sumsFor(ctx);
    const after = sumsFor(brokenCtx);
    expect(before.fuel).toBeGreaterThan(0);
    expect(after.fuel).toBe(0);
    expect(after.repairs).toBeCloseTo(before.repairs + before.fuel, 6);
    const moved = Object.keys(before).filter((key) => before[key] !== after[key]);
    expect(moved.sort()).toEqual(["fuel", "repairs"]);
  });
});

// ============================== the takings grain ==============================

function takingsFor(dir, mutate) {
  const fixture = calculated(dir);
  if (mutate) mutate(fixture);
  const ctx = ctxFor(fixture);
  return { fixture, takings: manifest.internals.groupTakings(fixture.lines, ctx.months) };
}

describe("groupTakings lays the fares out as the Sales sheet holds them", () => {
  const { takings } = takingsFor("basic-taxi-driver");
  const dayIn = (monthKey, date) => takings.months[monthKey].weeks.flatMap((week) => week.days).find((day) => day.date === date);

  it("a two-fare day is one day row with the sum and the joined names", () => {
    const day = dayIn("2025-04", "2025-04-07");
    expect(day.lines).toHaveLength(2);
    expect(day.takings).toBe(245);
    expect(day.names).toEqual(["Daily fares", "Airport run"]);
  });

  it("a grant named anything else is a day line on the day's other income", () => {
    const day = dayIn("2025-09", "2025-09-15");
    const grant = day.lines.filter((line) => line.other);
    expect(grant).toHaveLength(1);
    expect(day.other).toBe(grant[0].amount);
    expect(grant[0].detail).not.toBe("Any other income");
  });

  // The Sales tab's own two column totals: column E is the fares and the
  // week's rental rows, column F the day other-income cells and the week's
  // own other-income rows. The P&L reads one into row 5 and the other into
  // row 24, so a month's figures here are those two cells.
  it("each month's takings and other income are the sheet's own two monthly cells", () => {
    const results = calculated("basic-taxi-driver").results["Profit & Loss Acc"];
    for (const month of Object.values(takings.months)) {
      const col = manifest.yearTable.monthlyCell(month.label, taxi, "sales")[1].replace(/[0-9]/g, "");
      expect(Math.floor(month.takings + month.rental), `${month.key} takings`).toBe(results[`${col}5`]);
      expect(month.otherIncome, `${month.key} other income`).toBeCloseTo(results[`${col}24`], 2);
    }
  });

  it("the year's takings are the workbook's own turnover row", () => {
    const total = Object.values(takings.months).reduce((sum, month) => sum + month.takings + month.rental, 0);
    expect(Math.floor(total)).toBe(calculated("basic-taxi-driver").results["Profit & Loss Acc"].B5);
  });

  it("no fare day is marked for missing miles on a book that records none", () => {
    const days = Object.values(takings.months).flatMap((month) => month.weeks.flatMap((week) => week.days));
    expect(days.some((day) => day.isMissingMiles)).toBe(false);
    expect(takings.offGrid).toEqual([]);
  });
});

describe("the week's own caption rows", () => {
  const { takings } = takingsFor("kestrel-executive-cars");

  it("a Rental due line is the week's rental, wherever inside the week it falls", () => {
    const week = takings.months["2025-06"].weeks.find((w) => w.days.some((day) => day.date === "2025-06-13"));
    expect(week.rentalLines.map((line) => line.entryNumber)).toContain("TXN-0156");
    expect(week.rental).toBe(150);
    // The rental is the week's own row, so it is on no day of the week.
    expect(week.days.flatMap((day) => day.lines).map((line) => line.entryNumber)).not.toContain("TXN-0156");
  });

  it("an Any other income line is the week's other income", () => {
    const week = takings.months["2025-11"].weeks.find((w) => w.days.some((day) => day.date === "2025-11-14"));
    expect(week.otherIncomeLines.map((line) => line.entryNumber)).toContain("TXN-0158");
    expect(week.days.find((day) => day.date === "2025-11-14").other).toBe(0);
  });

  it("a week's total is its takings, its rental and its other income", () => {
    for (const month of Object.values(takings.months)) {
      for (const week of month.weeks) {
        expect(week.total).toBeCloseTo(week.takings + week.rental + week.otherIncome, 6);
      }
    }
  });
});

describe("takings the grid cannot hold, and days that should carry miles", () => {
  it("a sales line off the grid lands in offGrid and in no month", () => {
    const { takings } = takingsFor("basic-taxi-driver", (fixture) => {
      const fare = fixture.lines.find((line) => line.entryNumber === "TXN-0002");
      fixture.lines = fixture.lines.map((line) => (line === fare ? { ...line, postingDate: "2026-04-07" } : line));
    });
    expect(takings.offGrid).toEqual([{ entryNumber: "TXN-0002", postingDate: "2026-04-07", amount: 200, detail: "Daily fares" }]);
    const placed = Object.values(takings.months).flatMap((month) =>
      month.weeks.flatMap((week) => week.days.flatMap((day) => day.lines.map((line) => line.entryNumber))),
    );
    expect(placed).not.toContain("TXN-0002");
  });

  it("isMissingMiles marks a fare day without miles only on a book that carries them", () => {
    const { takings } = takingsFor("sp-sixty-driving", (fixture) => {
      const fare = fixture.lines.find((line) => line.sourceJournalID === "sales" && line.measurableUnitOfMeasure === "miles");
      fixture.lines = fixture.lines.map((line) =>
        line === fare ? { ...line, measurableQuantity: undefined, measurableUnitOfMeasure: undefined } : line,
      );
      fixture.cleared = fare;
    });
    const flagged = Object.values(takings.months)
      .flatMap((month) => month.weeks.flatMap((week) => week.days))
      .filter((day) => day.isMissingMiles);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.every((day) => day.takings > 0 && day.miles === 0)).toBe(true);
  });
});

// ============================== the snapshot's product half ==============================

describe("the snapshot's product half", () => {
  const fixture = calculated("basic-taxi-driver");
  const ctx = ctxFor(fixture);
  const snapshot = manifest.snapshot(ctx);
  const results = fixture.results;

  it("the annual row reads every category cell and the year's capitalised purchases", () => {
    for (const [key, cell] of Object.entries(PL_CELLS_BY_KEY)) {
      expect(snapshot.annual[key], key).toBe(results["Profit & Loss Acc"][cell] || 0);
    }
    expect(snapshot.annual.capex).toBe(results.PurchasesMar.T1);
  });

  it("the vehicle comparison is the sheet's own four figures and the route it took", () => {
    expect(snapshot.vehicle).toMatchObject({
      present: results.PurchasesMar.A1 > 0,
      miles: results.PurchasesMar.A1,
      allowance: results.PurchasesMar.A2,
      running: results.PurchasesMar.I2,
      compared: results["Profit & Loss Acc"].J1,
      charged: results["Profit & Loss Acc"].B12,
      route: "actual",
      routeText: null,
    });
    expect(snapshot.vehicle.forgone).toBe(results.PurchasesMar.A2);
  });

  it("the register is the book's own assets at the year's writing-down rate, with the schedule's totals", () => {
    expect(snapshot.register.assets).toEqual([
      {
        assetID: "FA-VEHICLE-001",
        description: "Taxi vehicle",
        cost: 8000,
        acquiredDate: "2025-06-01",
        wda: 8000 * taxData.capital_allowances.writing_down_allowance,
        writtenDown: 8000 - 8000 * taxData.capital_allowances.writing_down_allowance,
      },
    ]);
    expect(snapshot.register.unregistered).toEqual([]);
    expect(snapshot.register.totals.writtenDownValue).toBe(results["Fixed Assets"].K1);
    expect(snapshot.register.totals.capex).toBe(results.PurchasesMar.T1);
  });

  it("a capital purchase the register does not carry is listed as unregistered", () => {
    const bare = calculated("basic-taxi-driver");
    bare.book = { ...bare.book, fixedAssets: [] };
    const unregistered = manifest.snapshot(ctxFor(bare)).register.unregistered;
    expect(unregistered).toEqual([{ entryNumber: "TXN-0037", postingDate: "2025-06-01", amount: 8000, detail: "Car Dealer" }]);
  });

  it("the computation names every Draft Tax calculation cell once and dates both payments on account", () => {
    const cells = snapshot.computation.cells;
    const named = [
      cells.profit,
      cells.allowance,
      cells.taxable,
      ...cells.bands.flatMap((band) => [band.rate, band.ceiling, band.tax]).filter(Boolean),
      cells.incomeTax,
      ...cells.class4,
      cells.total,
      ...cells.paymentsOnAccount,
    ];
    const cellMapCells = taxi.CELL_MAP.filter((row) => row[4] === "Draft Tax Calculation").map((row) => row[1]);
    expect([...named].sort()).toEqual([...cellMapCells].sort());
    expect(new Set(named).size).toBe(named.length);
    expect(snapshot.computation.paymentsOnAccount.map((p) => p.due)).toEqual(["2027-01-31", "2027-07-31"]);
    expect(snapshot.computation.total).toBe(results[taxi.TAX_SHEET].E17);
  });

  it("Class 2 is the year's own weekly rate and threshold, voluntary only below it", () => {
    const profit = results[taxi.TAX_SHEET].E5;
    const class2 = snapshot.computation.class2;
    expect(class2.weekly).toBe(taxData.national_insurance.class2_weekly_rate);
    expect(class2.threshold).toBe(taxData.national_insurance.class2_small_profits_threshold);
    expect(profit).toBeGreaterThan(class2.threshold);
    expect(class2.amount).toBe(0);
    expect(class2.voluntary).toBe(false);
  });

  it("a profit under the threshold makes the year's contributions voluntary", () => {
    const bare = calculated("basic-taxi-driver");
    bare.results = { ...bare.results, [taxi.TAX_SHEET]: { ...bare.results[taxi.TAX_SHEET], E5: 1000 } };
    const class2 = manifest.snapshot(ctxFor(bare)).computation.class2;
    expect(class2.voluntary).toBe(true);
    expect(class2.amount).toBeCloseTo(taxData.national_insurance.class2_weekly_rate * 52, 2);
  });

  it("the quarterly rows are three figures across five columns", () => {
    expect(snapshot.quarterly.rows.map((row) => row.label)).toEqual(["Turnover", "Other income", "Total Allowable Expenses"]);
    for (const row of snapshot.quarterly.rows) {
      expect(row.cells).toHaveLength(5);
      for (const cell of row.cells) expect(cell.value).toBe(results[cell.sheet][cell.cell] || 0);
    }
  });

  it("the forecast is the Wages Forecast section with its months of trade", () => {
    expect(snapshot.forecast.monthsTraded).toBe(results["Wages Forecast"].C19);
    expect(snapshot.forecast.rows.map((row) => row.cell)).toEqual(
      taxi.CELL_MAP.filter((row) => row[4] === "Wages Forecast").map((row) => row[1]),
    );
  });

  it("the health check is the forecast profit against a month's share of the liability", () => {
    expect(snapshot.healthCheck.forecastProfit).toBe(results["Wages Forecast"].C30);
    expect(snapshot.healthCheck.liabilityTwelfth).toBeCloseTo(results["Wages Forecast"].C41 / 12, 6);
    expect(snapshot.healthCheck.drawings).toEqual([null, null, null, null]);
  });

  it("the Admin rates are the Admin CELL_MAP rows, with the four mileage cells printed as miles and pence", () => {
    const adminCells = taxi.CELL_MAP.filter((row) => row[4] === "Admin (Generator Injected)").map((row) => row[1]);
    expect(snapshot.admin.rates.map((r) => r.cell)).toEqual(adminCells);
    expect(snapshot.admin.rates.filter((r) => r.format === "number" || r.format === "pence").map((r) => [r.cell, r.format])).toEqual([
      ["F21", "number"],
      ["G21", "pence"],
      ["F22", "number"],
      ["G22", "pence"],
    ]);
    expect(snapshot.admin.year).toBe(taxData.tax_year.label);
  });

  it("every cell the snapshot keys is one standardReads() asks for", () => {
    const reads = taxi.standardReads();
    const has = (sheet, cell) => (reads[sheet] || []).includes(cell);
    for (const category of CATEGORIES) expect(has(category.sheet, category.cell), category.cell).toBe(true);
    for (const cell of Object.values(snapshot.register.cells)) expect(has("Fixed Assets", cell), cell).toBe(true);
    for (const cell of ["A1", "A2", "I2", "T1"]) expect(has("PurchasesMar", cell), cell).toBe(true);
    for (const cell of ["C1", "J1"]) expect(has("Profit & Loss Acc", cell), cell).toBe(true);
    for (const row of snapshot.quarterly.rows) for (const cell of row.cells) expect(has(cell.sheet, cell.cell), cell.cell).toBe(true);
    for (const row of snapshot.forecast.rows) expect(has(row.sheet, row.cell), row.cell).toBe(true);
    for (const cell of [...Object.values(snapshot.computation.cells).filter((v) => typeof v === "string")]) {
      expect(has(taxi.TAX_SHEET, cell), cell).toBe(true);
    }
  });
});

describe("the mileage route", () => {
  const fixture = calculated("sp-sixty-driving");
  const snapshot = manifest.snapshot(ctxFor(fixture));

  it("names the route the sheet took and what the other route would have charged", () => {
    expect(snapshot.vehicle.route).toBe("mileage");
    expect(snapshot.vehicle.routeText).toBe("MILEAGE ALLOWANCE");
    expect(snapshot.vehicle.charged).toBe(fixture.results["Profit & Loss Acc"].B12);
    expect(snapshot.vehicle.forgone).toBe(fixture.results["Profit & Loss Acc"].J1);
  });
});
