// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-taxi-forms.browser.test.js
//
// The Taxi SA103S render, proved against app/data/hmrc/form-layouts/taxi.json
// and the Draft Tax calculation view, on both routes the sheet can take:
// taxi-scenario-basic (actual cost) and taxi-scenario-sp-sixty (mileage).
// Every expected figure and key comes from report.js's own output (S2) or
// from calculateExpectedTax run in Node over the book's own tax data --
// nothing here is typed by hand.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";
import { s2, SCENARIOS_TAXI, parseFigure, canonical } from "./r-sources.js";
import { loadDiyaGlData, extractTaxDataFromBook } from "../../app/lib/diya-gl-loader.js";
import { calculateExpectedTax } from "../../app/lib/tax/income-tax.js";

const ROOT = process.cwd();
const publicDir = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const LAYOUT = JSON.parse(fs.readFileSync(path.join(ROOT, "app/data/hmrc/form-layouts/taxi.json"), "utf-8"));
const SE_SHORT = "SE Short";
const PL = "Profit & Loss Acc";
const TAX_SHEET = "Draft Tax calculation";

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

async function openBook(page, example) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/books/taxi.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: example.button }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function openView(page, viewId) {
  await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
  await expect(page.locator(`.tab-btn[data-view="${viewId}"]`)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#view-root .form-render").first()).toBeVisible();
}

// The box list of the sa103s form, flattened in layout order.
function layoutBoxes() {
  const out = [];
  for (const section of LAYOUT.forms.sa103s.sections) out.push(...section.boxes);
  return out;
}

// Every box on the page, in DOM order, with its own key (the "cell/" token
// only -- a data-r-key also carries a "section/" companion joined with
// " || ", which is A5's concern, not this box's own SE Short figure).
async function readBoxes(page) {
  return page.locator("#view-root .form-render .form-row").evaluateAll((rows) =>
    rows.map((row) => {
      const box = row.querySelector(".box-chip")?.textContent ?? "";
      const amountEl = row.querySelector(".form-amount-box");
      const raw = amountEl?.getAttribute("data-r-key") ?? "";
      const cellKey = raw.split(" || ").find((key) => key.startsWith("cell/")) ?? "";
      const parts = Array.from(row.querySelectorAll(".box-part")).map((part) => ({
        text: part.textContent ?? "",
        key:
          (part.querySelector("[data-r-key]")?.getAttribute("data-r-key") ?? "").split(" || ").find((key) => key.startsWith("cell/")) ?? "",
      }));
      return {
        box,
        text: (amountEl?.textContent ?? "").trim(),
        key: cellKey,
        note: row.querySelector(".sheet-placement")?.textContent ?? "",
        parts,
      };
    }),
  );
}

function byBox(boxes) {
  return new Map(boxes.map((box) => [box.box, box]));
}

// The report key a direct-cell box carries, only when S2 actually holds a
// value for that cell -- SE Short!O38 (box 10) names a cell in the layout
// but the calculator never writes it (a permanently blank manual entry), so
// its own box prints present and empty exactly like the boxes with no cell
// at all.
function expectedCellKey(s2Map, sheet, cell) {
  const key = `cell/${sheet}!${cell}`;
  return s2Map.has(key) ? key : null;
}

// The report key each box's own amount carries, given the route the sheet
// took. Boxes 11 to 20 read the Profit & Loss Account rather than SE
// Short's own (unmapped) expense block; "sum:" boxes and the box-20 total
// carry no key of their own -- their parts, or nothing, do.
function expectedBoxKey(s2Map, box, route) {
  if (box.cell) return expectedCellKey(s2Map, SE_SHORT, box.cell);
  if (!box.derived) return null;
  if (box.derived.startsWith("pl:")) return expectedCellKey(s2Map, PL, box.derived.slice(3));
  if (box.derived.startsWith("sum:")) return null;
  if (box.derived === "vehicleTravel") return route === "mileage" ? expectedCellKey(s2Map, PL, "B11") : null;
  if (box.derived === "repairs") return route === "mileage" ? null : expectedCellKey(s2Map, PL, "B8");
  return null; // goodsForResale, totalExpenses
}

function fmtMoney(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);
}

function num(s2Map, sheet, cell) {
  const entry = s2Map.get(`cell/${sheet}!${cell}`);
  return entry ? Number(entry.value) : 0;
}

// The figure the sheet's own D46 computes (box 12 - box 10 on the sheet's
// pre-2026 numbering, i.e. Profit & Loss Acc!B12 - B10): SE Short!D46 itself
// carries no CELL_MAP row, so this is the same formula the render's own
// notes use to state it, computed independently here from the P&L cells S2
// does carry.
function sheetD46Figure(s2Map) {
  return num(s2Map, PL, "B12") - num(s2Map, PL, "B10");
}

for (const { label, example, route } of [
  { label: "taxi-scenario-basic (actual cost route)", example: basicExample(), route: "actual" },
  { label: "taxi-scenario-sp-sixty (mileage route)", example: spSixtyExample(), route: "mileage" },
]) {
  test.describe(`DIYA-GL Taxi books page — the SA103S form (T18), ${label}`, () => {
    test("the box chips are the layout's box list, in the layout's order", async ({ page }) => {
      await openBook(page, example);
      await openView(page, "sa103s");
      const chips = await page.locator("#view-root .form-render .box-chip").allTextContents();
      expect(chips).toEqual(layoutBoxes().map((box) => box.box));
    });

    test("the box-level key set equals the one the layout and S2 predict for this route", async ({ page }) => {
      const s2Map = s2(example.bookDir, example.scenario, "taxi");
      await openBook(page, example);
      await openView(page, "sa103s");
      const boxes = await readBoxes(page);

      const expected = new Map();
      for (const box of layoutBoxes()) {
        const key = expectedBoxKey(s2Map, box, route);
        if (key) expected.set(box.box, key);
      }

      const mismatches = [];
      for (const box of boxes) {
        const wantKey = expected.get(box.box) || "";
        if (box.key !== wantKey) mismatches.push(`box ${box.box}: rendered key "${box.key}", expected "${wantKey}"`);
      }
      expect(mismatches, mismatches.join("\n")).toEqual([]);
      expect(new Set(boxes.filter((box) => box.key).map((box) => box.box))).toEqual(new Set(expected.keys()));
    });

    test("boxes 33 to 38 print present and empty, with no key", async ({ page }) => {
      await openBook(page, example);
      await openView(page, "sa103s");
      const boxes = byBox(await readBoxes(page));
      for (const boxNumber of ["33", "34", "35", "36", "37", "38"]) {
        const box = boxes.get(boxNumber);
        expect(box, `box ${boxNumber} is on the page`).toBeTruthy();
        expect(box.text, `box ${boxNumber} prints nothing`).toBe("");
        expect(box.key, `box ${boxNumber} claims no report key`).toBe("");
      }
    });

    test("box 11's margin states the sheet's own placement, SE Short!D46's figure", async ({ page }) => {
      const s2Map = s2(example.bookDir, example.scenario, "taxi");
      await openBook(page, example);
      await openView(page, "sa103s");
      const box11 = byBox(await readBoxes(page)).get("11");
      expect(box11.text).toBe("");
      expect(box11.key).toBe("");
      expect(box11.note).toContain(fmtMoney(sheetD46Figure(s2Map)));
      expect(box11.note).toContain("vehicle costs less capital allowances");
    });

    test("box 12's margin says the sheet files this under box 11, on both routes", async ({ page }) => {
      await openBook(page, example);
      await openView(page, "sa103s");
      const box12 = byBox(await readBoxes(page)).get("12");
      expect(box12.note).toBe("The sheet files this under box 11.");
    });
  });
}

test.describe("DIYA-GL Taxi books page — the SA103S form (T18), route-specific boxes", () => {
  test("sp-sixty: box 12 carries the mileage claim (Profit & Loss Acc!B11) and box 11 stays empty", async ({ page }) => {
    const example = spSixtyExample();
    const s2Map = s2(example.bookDir, example.scenario, "taxi");
    await openBook(page, example);
    await openView(page, "sa103s");
    const boxes = byBox(await readBoxes(page));

    const box12 = boxes.get("12");
    expect(box12.key).toBe("cell/Profit & Loss Acc!B11");
    const expectedClaim = canonical(num(s2Map, PL, "B11"), "money");
    expect(canonical(parseFigure(box12.text).value, "money")).toBe(expectedClaim);

    const box11 = boxes.get("11");
    expect(box11.text).toBe("");
    expect(box11.key).toBe("");
  });

  test("sp-sixty: box 15 (repairs) is empty and its note carries SE Short!D46's figure", async ({ page }) => {
    const example = spSixtyExample();
    const s2Map = s2(example.bookDir, example.scenario, "taxi");
    await openBook(page, example);
    await openView(page, "sa103s");
    const box15 = byBox(await readBoxes(page)).get("15");
    expect(box15.text).toBe("");
    expect(box15.key).toBe("");
    expect(box15.note).toContain(fmtMoney(sheetD46Figure(s2Map)));
    expect(box15.note).toContain("Repairs are inside the mileage rate this year");
  });

  test("basic: box 12 carries fuel + car hire + road tax and insurance (B6 + B7 + B9), each part keyed", async ({ page }) => {
    const example = basicExample();
    const s2Map = s2(example.bookDir, example.scenario, "taxi");
    await openBook(page, example);
    await openView(page, "sa103s");
    const box12 = byBox(await readBoxes(page)).get("12");

    expect(box12.key).toBe("");
    const expectedTotal = num(s2Map, PL, "B6") + num(s2Map, PL, "B7") + num(s2Map, PL, "B9");
    expect(canonical(parseFigure(box12.text).value, "money")).toBe(canonical(expectedTotal, "money"));

    const wantParts = { B6: "fuel", B7: "car hire", B9: "road tax and insurance" };
    expect(box12.parts).toHaveLength(3);
    for (const part of box12.parts) {
      const cell = Object.keys(wantParts).find((c) => part.key === `cell/Profit & Loss Acc!${c}`);
      expect(cell, `part "${part.text}" keys to one of B6, B7, B9`).toBeTruthy();
      expect(part.text).toContain(wantParts[cell]);
    }
  });

  test("basic: box 15 carries repairs (B8), no note", async ({ page }) => {
    const example = basicExample();
    const s2Map = s2(example.bookDir, example.scenario, "taxi");
    await openBook(page, example);
    await openView(page, "sa103s");
    const box15 = byBox(await readBoxes(page)).get("15");
    expect(box15.key).toBe("cell/Profit & Loss Acc!B8");
    expect(canonical(parseFigure(box15.text).value, "money")).toBe(canonical(num(s2Map, PL, "B8"), "money"));
    expect(box15.note).toBe("");
  });

  test("basic: boxes 23 to 25 carry SE Short!D80, D85, O80", async ({ page }) => {
    const example = basicExample();
    const s2Map = s2(example.bookDir, example.scenario, "taxi");
    await openBook(page, example);
    await openView(page, "sa103s");
    const boxes = byBox(await readBoxes(page));

    for (const [boxNumber, cell] of [
      ["23", "D80"],
      ["24", "D85"],
      ["25", "O80"],
    ]) {
      const box = boxes.get(boxNumber);
      expect(box.key, `box ${boxNumber}`).toBe(`cell/SE Short!${cell}`);
      expect(canonical(parseFigure(box.text).value, "money"), `box ${boxNumber}`).toBe(canonical(num(s2Map, SE_SHORT, cell), "money"));
    }
  });
});

// ── The tax computation ─────────────────────────────────────────────────
//
function computationLine(page, line) {
  return page.locator(`#view-root .form-row[data-line="${line}"] .form-amount-box`);
}

for (const example of [basicExample(), spSixtyExample()]) {
  test.describe(`DIYA-GL Taxi books page — the tax computation (T18), ${example.scenario}`, () => {
    test("the computation's lines equal calculateExpectedTax(profit, taxData), Class 2 included", async ({ page }) => {
      const s2Map = s2(example.bookDir, example.scenario, "taxi");
      const { book } = loadDiyaGlData(path.resolve(ROOT, example.bookDir));
      const taxData = extractTaxDataFromBook(book, "taxi");
      const profit = num(s2Map, TAX_SHEET, "E5");
      const expected = calculateExpectedTax(profit, taxData);

      await openBook(page, example);
      await openView(page, "tax-computation");

      const incomeTaxText = await computationLine(page, "E11").textContent();
      expect(canonical(parseFigure(incomeTaxText).value, "money")).toBe(canonical(expected.income_tax, "money"));

      const class4LowerText = await computationLine(page, "E14").textContent();
      expect(canonical(parseFigure(class4LowerText).value, "money")).toBe(canonical(expected.ni_class4_lower, "money"));

      const class4UpperText = await computationLine(page, "E15").textContent();
      expect(canonical(parseFigure(class4UpperText).value, "money")).toBe(canonical(expected.ni_class4_upper, "money"));

      const totalText = await computationLine(page, "E17").textContent();
      expect(canonical(parseFigure(totalText).value, "money")).toBe(canonical(expected.total_tax_and_ni, "money"));

      // Both example books sit above the small profits threshold, so Class
      // 2 is nil on each -- the threshold and the weekly rate themselves
      // come from the tax-year file the book carries (7,105 and 3.65 for
      // 2026/27), read here through the same calculateExpectedTax call.
      expect(expected.ni_class2).toBe(0);
      const class2Text = await page.locator('#view-root .form-row[data-line="class2"] .class2-sentence').textContent();
      expect(class2Text).toContain("Nil");
      expect(class2Text).toContain(fmtMoney(expected.ni_class2_threshold));
    });
  });
}
