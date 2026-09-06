// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-taxi-views.browser.test.js
//
// The view-level proofs products/taxi-views.js carries: the vehicle
// comparison panel, the vehicle register, the quarterly and forecast
// summaries, and that a pencil correction survives a re-render rather than
// only ever appearing once. books-taxi-forms.browser.test.js covers the
// SA103S and the tax computation; this file covers everything else
// taxi-views.js renders. Every expected figure comes from report.js's own
// output (S2) through r-sources.js, or is read directly off the committed
// examples/taxi-latest workbook's own cached cells -- nothing here is typed
// by hand.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { s2, SCENARIOS_TAXI, parseFigure, canonical } from "./r-sources.js";
import { loadDiyaGlData } from "../../app/lib/diya-gl-loader.js";
import { productModule } from "../../app/lib/products.js";

const ROOT = process.cwd();
const publicDir = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const PL = "Profit & Loss Acc";
const PURCHASES = "PurchasesMar";
const FIXED_ASSETS = "Fixed Assets";
const VITAL_TAX = "VitalTax";
const WAGES_FORECAST = "Wages Forecast";
const FRESH_PACKAGE_PATH = path.join(ROOT, "examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx");

const TAXI_CELL_MAP = productModule("taxi").CELL_MAP;

let closeServer;
let baseUrl;

test.beforeAll(async () => {
  const server = await startStaticServer(publicDir);
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer();
});

function basicExample() {
  return SCENARIOS_TAXI.find((example) => example.scenario === "taxi-scenario-basic");
}
function spSixtyExample() {
  return SCENARIOS_TAXI.find((example) => example.scenario === "taxi-scenario-sp-sixty");
}
function kestrelExample() {
  return SCENARIOS_TAXI.find((example) => example.scenario === "taxi-scenario-kestrel");
}

async function openBook(page, example) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/books/taxi.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: example.button }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function openView(page, viewId) {
  await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
  await expect(page.locator(`.tab-btn[data-view="${viewId}"]`)).toHaveAttribute("aria-selected", "true");
}

function num(s2Map, sheet, cell) {
  const entry = s2Map.get(`cell/${sheet}!${cell}`);
  return entry ? Number(entry.value) : 0;
}

function fmtMoney(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);
}

// helpers.rkFor joins a cell key to its section key with " || " (shell.js's
// rk()), so a data-r-key attribute is never just "cell/Sheet!Ref" on its
// own -- the cell half is always the token that starts with "cell/".
function cellKeyOnly(raw) {
  return (raw || "").split(" || ").find((key) => key.startsWith("cell/")) ?? "";
}

// The Quarterly Summary and Wages Forecast row labels the way taxi.js's own
// quarterlyRowLabel and plainLabel strip them: "**" removed, and a leading
// "Q1"/"Q2"/"Q3"/"Q4"/"Annual" removed from the label a row is first seen
// under (Quarterly Summary groups four quarter cells and one annual cell
// under one row, keyed by the row's digits).
function plainLabel(label) {
  return String(label).replace(/\*\*/g, "");
}
function quarterlyRowLabel(label) {
  return plainLabel(label).replace(/^(Q[1-4]|Annual)\s+/, "");
}
function expectedQuarterlyLabel(rowDigits) {
  const row = TAXI_CELL_MAP.find((r) => r[4] === "Quarterly Summary" && r[1].replace(/[^0-9]/g, "") === rowDigits);
  return quarterlyRowLabel(row[2]);
}
function expectedForecastLabel(cell) {
  const row = TAXI_CELL_MAP.find((r) => r[0] === WAGES_FORECAST && r[1] === cell && r[4] === "Wages Forecast");
  return plainLabel(row[2]);
}

// ── The vehicle comparison panel ────────────────────────────────────────
//
// T12's log entry records that only SP Sixty logs miles, so the comparison
// sentence's mileage-route branch is proved on sp-sixty alone; basic and
// kestrel both take the "no business miles" branch even though kestrel's
// route is "actual" and carries a register. Figures TX-T18 found hidden on
// a no-miles book (miles, allowance) are asserted present on every book
// here, since that is the fix TX-T18 made and this spec is the proof of it.

const COMPARISON_FIGURE_CELLS = {
  miles: { sheet: PURCHASES, cell: "A1", unit: "count" },
  allowance: { sheet: PURCHASES, cell: "A2", unit: "money" },
  running: { sheet: PURCHASES, cell: "I2", unit: "money" },
  compared: { sheet: PL, cell: "J1", unit: "money" },
  charged: { sheet: PL, cell: "B12", unit: "money" },
};

async function readComparisonFigures(page) {
  return page.locator("#view-root .comparison-figures .comparison-figure").evaluateAll((nodes) =>
    nodes.map((node) => {
      const raw = node.querySelector(".figure-value")?.getAttribute("data-r-key") ?? "";
      return {
        name: node.getAttribute("data-figure"),
        text: node.querySelector(".figure-value")?.textContent ?? "",
        key: raw.split(" || ").find((key) => key.startsWith("cell/")) ?? "",
      };
    }),
  );
}

for (const { label, example, route } of [
  { label: "taxi-scenario-basic (actual cost, no miles logged)", example: basicExample(), route: "actual" },
  { label: "taxi-scenario-sp-sixty (mileage route)", example: spSixtyExample(), route: "mileage" },
  { label: "taxi-scenario-kestrel (actual cost, a register, no miles logged)", example: kestrelExample(), route: "actual" },
]) {
  test.describe(`DIYA-GL Taxi books page — the vehicle comparison panel, ${label}`, () => {
    test("all five vehicle figures print, each keyed to its own S2 cell", async ({ page }) => {
      const s2Map = s2(example.bookDir, example.scenario, "taxi");
      await openBook(page, example);
      await openView(page, "profit-loss");

      const panel = page.locator("#view-root .vehicle-comparison");
      await expect(panel).toHaveAttribute("data-route", route);

      const figures = await readComparisonFigures(page);
      expect(figures.map((figure) => figure.name)).toEqual(["miles", "allowance", "running", "compared", "charged"]);

      for (const figure of figures) {
        const { sheet, cell, unit } = COMPARISON_FIGURE_CELLS[figure.name];
        expect(figure.key, figure.name).toBe(`cell/${sheet}!${cell}`);
        expect(canonical(parseFigure(figure.text).value, unit), figure.name).toBe(canonical(num(s2Map, sheet, cell), unit));
      }
    });
  });
}

test.describe("DIYA-GL Taxi books page — the vehicle comparison panel, route-specific text", () => {
  test("basic and kestrel: no business miles logged, so the sheet cell is not printed and the sentence says so", async ({ page }) => {
    for (const example of [basicExample(), kestrelExample()]) {
      await openBook(page, example);
      await openView(page, "profit-loss");
      await expect(page.locator("#view-root .comparison-route-cell")).toHaveCount(0);
      await expect(page.locator("#view-root .comparison-sentence")).toHaveText(
        "This book records no business miles, so the accounts charge the vehicle's running costs.",
      );
    }
  });

  test("sp-sixty: the sheet's own C1 names the mileage route, and the sentence carries A2 and I2", async ({ page }) => {
    const example = spSixtyExample();
    const s2Map = s2(example.bookDir, example.scenario, "taxi");
    await openBook(page, example);
    await openView(page, "profit-loss");

    const routeCell = page.locator("#view-root .comparison-route-cell");
    await expect(routeCell).toContainText("MILEAGE ALLOWANCE");
    expect(cellKeyOnly(await routeCell.locator("span").getAttribute("data-r-key"))).toBe("cell/Profit & Loss Acc!C1");

    const allowance = num(s2Map, PURCHASES, "A2");
    const running = num(s2Map, PURCHASES, "I2");
    await expect(page.locator("#view-root .comparison-sentence")).toHaveText(
      "The mileage allowance is " +
        fmtMoney(allowance) +
        " and running the car cost " +
        fmtMoney(running) +
        ", so this year's accounts claim the allowance; fuel, repairs, road tax and insurance receipts are recorded but not charged.",
    );
  });
});

// ── The vehicle register ────────────────────────────────────────────────

for (const { label, example, description } of [
  { label: "basic", example: basicExample(), description: "Taxi vehicle" },
  { label: "sp-sixty", example: spSixtyExample(), description: "Nextbase dashcam" },
  { label: "kestrel", example: kestrelExample(), description: "In-car camera system" },
]) {
  test.describe(`DIYA-GL Taxi books page — the vehicle register, ${label}`, () => {
    test(`lists ${description} with its cost, WDA and written-down value from S2`, async ({ page }) => {
      const s2Map = s2(example.bookDir, example.scenario, "taxi");
      const { book } = loadDiyaGlData(path.resolve(ROOT, example.bookDir));
      const asset = book.fixedAssets[0];
      const acquiredIso = new Date(asset.acquiredDate).toISOString().slice(0, 10);

      await openBook(page, example);
      await openView(page, "fixed-assets");

      const rows = page.locator("#view-root table.vehicle-register tbody tr[data-asset]");
      await expect(rows).toHaveCount(1);

      const row = rows.first();
      await expect(row.locator("td").nth(0)).toHaveText(acquiredIso);
      await expect(row.locator("td").nth(1)).toHaveText(description);

      const costCell = row.locator("td.num").nth(0);
      expect(cellKeyOnly(await costCell.getAttribute("data-r-key"))).toBe(`cell/${FIXED_ASSETS}!D47`);
      expect(canonical(parseFigure(await costCell.textContent()).value, "money")).toBe(canonical(num(s2Map, FIXED_ASSETS, "D47"), "money"));

      const personalUse = row.locator("td.num").nth(1);
      await expect(personalUse).toHaveText("—");
      await expect(personalUse).toHaveAttribute("title", "the workbook's F column; the book has no field for it");

      const wdaCell = row.locator("td.num").nth(2);
      expect(canonical(parseFigure(await wdaCell.textContent()).value, "money")).toBe(canonical(num(s2Map, FIXED_ASSETS, "J1"), "money"));

      const writtenDownCell = row.locator("td.num").nth(3);
      expect(canonical(parseFigure(await writtenDownCell.textContent()).value, "money")).toBe(
        canonical(num(s2Map, FIXED_ASSETS, "K1"), "money"),
      );
    });
  });
}

test.describe("DIYA-GL Taxi books page — the vehicle register totals", () => {
  for (const example of [basicExample(), spSixtyExample(), kestrelExample()]) {
    test(`${example.scenario}: the register's totals are keyed to PurchasesMar T1, Fixed Assets J1 and K1`, async ({ page }) => {
      const s2Map = s2(example.bookDir, example.scenario, "taxi");
      await openBook(page, example);
      await openView(page, "fixed-assets");

      const footTds = page.locator("#view-root table.vehicle-register tfoot td.num");
      await expect(footTds).toHaveCount(3);

      const costCell = footTds.nth(0);
      expect(cellKeyOnly(await costCell.getAttribute("data-r-key"))).toBe(`cell/${PURCHASES}!T1`);
      expect(canonical(parseFigure(await costCell.textContent()).value, "money")).toBe(canonical(num(s2Map, PURCHASES, "T1"), "money"));

      const wdaCell = footTds.nth(1);
      expect(cellKeyOnly(await wdaCell.getAttribute("data-r-key"))).toBe(`cell/${FIXED_ASSETS}!J1`);
      expect(canonical(parseFigure(await wdaCell.textContent()).value, "money")).toBe(canonical(num(s2Map, FIXED_ASSETS, "J1"), "money"));

      const writtenDownCell = footTds.nth(2);
      expect(cellKeyOnly(await writtenDownCell.getAttribute("data-r-key"))).toBe(`cell/${FIXED_ASSETS}!K1`);
      expect(canonical(parseFigure(await writtenDownCell.textContent()).value, "money")).toBe(
        canonical(num(s2Map, FIXED_ASSETS, "K1"), "money"),
      );
    });
  }
});

// ── The quarterly summary ───────────────────────────────────────────────

const QUARTERLY_ROWS = [
  { rowDigits: "5", sheet: VITAL_TAX, cell: "G5" },
  { rowDigits: "6", sheet: VITAL_TAX, cell: "G6" },
  { rowDigits: "29", sheet: VITAL_TAX, cell: "G29" },
];

test.describe("DIYA-GL Taxi books page — the quarterly summary", () => {
  for (const example of [basicExample(), spSixtyExample(), kestrelExample()]) {
    test(`${example.scenario}: the Year column equals S2's own Annual VitalTax cells`, async ({ page }) => {
      const s2Map = s2(example.bookDir, example.scenario, "taxi");
      await openBook(page, example);
      await openView(page, "quarterly");

      const rows = page.locator("#view-root table.quarterly-table tbody tr");
      await expect(rows).toHaveCount(QUARTERLY_ROWS.length);

      for (const [index, expected] of QUARTERLY_ROWS.entries()) {
        const row = rows.nth(index);
        await expect(row.locator("th")).toHaveText(expectedQuarterlyLabel(expected.rowDigits));

        const yearCell = row.locator("td.num").last();
        expect(cellKeyOnly(await yearCell.getAttribute("data-r-key"))).toBe(`cell/${expected.sheet}!${expected.cell}`);
        expect(canonical(parseFigure(await yearCell.textContent()).value, "money")).toBe(
          canonical(num(s2Map, expected.sheet, expected.cell), "money"),
        );
      }
    });
  }
});

// ── The forecast ─────────────────────────────────────────────────────────

test.describe("DIYA-GL Taxi books page — the forecast", () => {
  for (const example of [basicExample(), spSixtyExample(), kestrelExample()]) {
    test(`${example.scenario}: months traded prints as a count, and C30/C41 are the total rows`, async ({ page }) => {
      const s2Map = s2(example.bookDir, example.scenario, "taxi");
      await openBook(page, example);
      await openView(page, "forecast");

      const monthsTraded = num(s2Map, WAGES_FORECAST, "C19");
      expect(monthsTraded).toBe(12);
      // A book with a full year traded carries no "N of 12 months" lede --
      // every Taxi fixture trades the full year, so this branch has no
      // fixture that would exercise it.
      await expect(page.locator("#view-root .view-lede")).toHaveCount(0);

      const rows = page.locator("#view-root .panel-card table.kv-table tr");
      const monthsRow = rows.filter({ has: page.locator("td", { hasText: "of 12 months" }) });
      await expect(monthsRow.locator("td").first()).toHaveText("Months of actual trade");
      await expect(monthsRow.locator("td").nth(1)).toHaveText(`${monthsTraded} of 12 months`);

      for (const cell of ["C30", "C41"]) {
        const label = expectedForecastLabel(cell);
        const row = rows.filter({ has: page.locator("td", { hasText: label }) });
        await expect(row).toHaveClass(/total/);
        const valueCell = row.locator("td").nth(1);
        expect(cellKeyOnly(await valueCell.getAttribute("data-r-key"))).toBe(`cell/${WAGES_FORECAST}!${cell}`);
        expect(canonical(parseFigure(await valueCell.textContent()).value, "money")).toBe(
          canonical(num(s2Map, WAGES_FORECAST, cell), "money"),
        );
      }
    });
  }
});

// ── Drift survives a re-render, at the DOM level ────────────────────────
//
// shell.js's render() replaces #view-root's whole innerHTML and reapplies
// applyDriftMarks from scratch on every call (books/shell.js render()), so a
// mark that only ever showed up once, immediately after the upload that
// found it, would prove nothing about the walker itself. This corrupts
// Fixed Assets!J1 (the vehicle register's WDA total, a formula cell so the
// corruption cannot also poison the fresh extraction the way a corrupted
// register input cell would), switches away to another view and back --
// forcing a full render() cycle -- and checks the mark is still there.

async function xmlEscapeAttr(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sheetPathByName(zip, sheetName) {
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const escaped = await xmlEscapeAttr(sheetName);
  const tag = [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)].find((m) => m[1].includes(`name="${escaped}"`));
  if (!tag) throw new Error(`sheet "${sheetName}" not found in the fixture workbook`);
  const rid = /r:id="([^"]+)"/.exec(tag[1])[1];
  const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(relsXml)[1];
  return `xl/${target}`;
}

async function cachedValue(sourcePath, sheetName, cellRef) {
  const zip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
  const sheetPath = await sheetPathByName(zip, sheetName);
  const xml = await zip.file(sheetPath).async("string");
  const cellPattern = new RegExp(`<c\\s+r="${cellRef}"[^>]*>[\\s\\S]*?<v>([\\s\\S]*?)</v>[\\s\\S]*?</c>`);
  const match = cellPattern.exec(xml);
  if (!match) throw new Error(`cell ${sheetName}!${cellRef} not found or is self-closing`);
  return Number(match[1]);
}

async function corruptedCachedValue(sourcePath, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
  const sheetPath = await sheetPathByName(zip, sheetName);
  const xml = await zip.file(sheetPath).async("string");
  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"[^>]*>)([\\s\\S]*?)(</c>)`);
  if (!cellPattern.test(xml)) throw new Error(`cell ${sheetName}!${cellRef} not found or is self-closing`);
  const patched = xml.replace(
    cellPattern,
    (full, open, inner, close) => open + inner.replace(/<v>[\s\S]*?<\/v>/, `<v>${newValue}</v>`) + close,
  );
  zip.file(sheetPath, patched);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function uploadFile(page, buffer, name) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/books/taxi.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#file-picker").setInputFiles({
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
}

async function waitForLoaded(page) {
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

test.describe("DIYA-GL Taxi books page — drift survives a re-render", () => {
  test("a corrupted vehicle register WDA total keeps its pencil correction after switching views away and back", async ({ page }) => {
    const originalWda = await cachedValue(FRESH_PACKAGE_PATH, FIXED_ASSETS, "J1");
    const corruptedWda = 424242;
    expect(corruptedWda).not.toBe(originalWda);

    const corrupted = await corruptedCachedValue(FRESH_PACKAGE_PATH, FIXED_ASSETS, "J1", String(corruptedWda));
    await uploadFile(page, corrupted, "corrupted-wda.xlsx");
    await waitForLoaded(page);

    const driftEntry = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.drift.find((entry) => entry.id === "Fixed Assets!J1") || null);
    expect(driftEntry, "Fixed Assets!J1 carries a drift entry").toBeTruthy();
    expect(driftEntry.asRead).toBe(corruptedWda);
    expect(driftEntry.computed).toBe(originalWda);

    async function wdaFootCell() {
      return page.locator("#view-root table.vehicle-register tfoot td.num").nth(1);
    }

    for (let round = 0; round < 3; round++) {
      await openView(page, "fixed-assets");
      const wdaCell = await wdaFootCell();
      const correction = wdaCell.locator(".pencil-correction");
      await expect(correction, `round ${round}: exactly one mark on the WDA total`).toHaveCount(1);
      await expect(correction.locator(".as-read")).toContainText("424,242");
      const computedValue = correction.locator(".computed-value");
      expect(cellKeyOnly(await computedValue.getAttribute("data-r-key"))).toBe(`cell/${FIXED_ASSETS}!J1`);
      expect(canonical(parseFigure(await computedValue.textContent()).value, "money")).toBe(canonical(originalWda, "money"));

      // Force a full render() cycle on another view before switching back,
      // so the next round's mark is proved freshly reapplied, not merely
      // left over from the DOM the upload itself first built.
      await openView(page, "profit-loss");
    }
  });
});
