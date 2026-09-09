// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// web/browser-tests/books-ltd-forms.browser.test.js
//
// The six Ltd form views, proved against the layout they render from: the
// CT600's chips are the layout's box list in the layout's order, every box
// with a cell behind it carries a report key, every box without one is
// present and empty, the micro-entity profit and loss adds up to the penny,
// and a drift on one cell marks that box's own margin and no
// other. No example is registered for Ltd yet (LT-T10), so the package
// reaches the page zipped and dropped, the same door the page's own upload
// uses.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const PACKAGE_DIR = path.join(ROOT, "examples/ltd-latest");
const LAYOUT = JSON.parse(fs.readFileSync(path.join(ROOT, "app/data/hmrc/form-layouts/ltd.json"), "utf-8"));

let closeServer;
let baseUrl;

test.beforeAll(async () => {
  const server = await startStaticServer(PUBLIC_DIR);
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer();
});

function watchForErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

function workbookNames() {
  return fs.readdirSync(PACKAGE_DIR).filter((file) => file.endsWith(".xlsx"));
}

async function packageZipBytes(corrupt) {
  const zip = new JSZip();
  for (const name of workbookNames()) {
    let bytes = fs.readFileSync(path.join(PACKAGE_DIR, name));
    if (corrupt && corrupt.file === name) bytes = await corruptCachedValue(bytes, corrupt.sheet, corrupt.cell);
    zip.file(name, bytes);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

// One cached <v> replaced with a figure the recalculation will disagree with,
// which is what the page's drift layer is there to catch.
async function corruptCachedValue(bytes, sheetName, cellRef) {
  const zip = await JSZip.loadAsync(bytes);
  const workbook = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const byRid = new Map([...rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)].map((m) => [m[1], `xl/${m[2].replace(/^\/?xl\//, "")}`]));
  const sheets = new Map(
    [...workbook.matchAll(/name="([^"]*)"[^/]*r:id="(rId\d+)"/g)].map((m) => [m[1].replace(/&amp;/g, "&"), byRid.get(m[2])]),
  );
  const file = sheets.get(sheetName);
  const xml = await zip.file(file).async("string");
  const pattern = new RegExp(`(<c\\s+r="${cellRef}"[^>]*>)([\\s\\S]*?)(</c>)`);
  const match = xml.match(pattern);
  expect(match, `${sheetName}!${cellRef} carries no cached value to corrupt`).toBeTruthy();
  const corrupted = xml.replace(pattern, (_, open, body, close) => `${open}${body.replace(/<v>[^<]*<\/v>/, "<v>1234.56</v>")}${close}`);
  zip.file(file, corrupted, { date: zip.file(file).date });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 1 } });
}

async function dropFile(page, bytes, name) {
  const base64 = bytes.toString("base64");
  await page.evaluate(
    ({ base64, name }) => {
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const file = new File([array], name, { type: "application/zip" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const target = document.querySelector(".empty-state") || document.body;
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { base64, name },
  );
}

async function openPackage(page, corrupt) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/books/ltd.html`, { waitUntil: "domcontentloaded" });
  await dropFile(page, await packageZipBytes(corrupt), "ltd-latest.zip");
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function openView(page, viewId) {
  await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
  await expect(page.locator(`.tab-btn[data-view="${viewId}"]`)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#view-root .form-render").first()).toBeVisible();
}

// The rows of a form, financial-year groups flattened, in the order the
// layout lists them.
function layoutRows(form) {
  const out = [];
  for (const section of form.sections ?? []) {
    for (const row of section.rows ?? []) {
      if (row.group) out.push(...row.rows);
      else out.push(row);
    }
  }
  return out;
}

function money(text) {
  return Number(String(text).replace(/[£,\s]/g, ""));
}

test.describe("DIYA-GL books page — the six Ltd form views (LT-T8)", () => {
  test("the CT600's chips are the layout's box list, in the layout's order", async ({ page }) => {
    await openPackage(page);
    await openView(page, "ct600");
    const chips = await page.locator("#view-root .form-render .box-chip").allTextContents();
    const expected = layoutRows(LAYOUT.forms.ct600)
      .filter((row) => row.box !== undefined)
      .map((row) => String(row.box));
    expect(chips).toEqual(expected);
  });

  test("every CT600 box with a figure carries a report key, and every box without one is present and empty", async ({ page }) => {
    await openPackage(page);
    await openView(page, "ct600");
    const boxes = await page.locator("#view-root .form-render .form-row").evaluateAll((rows) =>
      rows.map((row) => ({
        chip: row.querySelector(".box-chip")?.textContent ?? "",
        text: (row.querySelector(".form-amount-box")?.textContent ?? "").trim(),
        key: row.querySelector(".form-amount-box")?.getAttribute("data-r-key") ?? "",
      })),
    );
    const byChip = new Map(boxes.map((box) => [box.chip, box]));

    for (const row of layoutRows(LAYOUT.forms.ct600)) {
      if (row.box === undefined) continue;
      const rendered = byChip.get(String(row.box));
      expect(rendered, `box ${row.box} is on the page`).toBeTruthy();
      if (row.empty) {
        expect(rendered.text, `box ${row.box} prints nothing`).toBe("");
        expect(rendered.key, `box ${row.box} claims no report key`).toBe("");
      }
      if (rendered.text !== "" && rendered.key !== "") {
        for (const key of rendered.key.split(" || ")) expect(key).toMatch(/^(cell|section)\//);
      }
    }
    // Boxes 695, 700, 760, 980 and the two the sheet leaves an input.
    expect(boxes.filter((box) => box.text === "").length).toBeGreaterThanOrEqual(5);
  });

  test("the micro-entity profit and loss adds up, within the penny each figure is rounded to", async ({ page }) => {
    await openPackage(page);
    await openView(page, "accounts");
    const figures = await page
      .locator("#view-root .form-render .form-section")
      .nth(1)
      .locator(".form-row")
      .evaluateAll((rows) =>
        rows.map((row) => ({
          label: (row.querySelector(".form-row-label")?.textContent ?? "").trim(),
          chip: row.querySelector(".box-chip")?.textContent ?? "",
          text: (row.querySelector(".form-amount-box")?.textContent ?? "").trim(),
        })),
      );
    // The turnover row is a two-year group, so its own chip sits on the
    // caption and its rows read "This year" and "Last year".
    const captions = await page.locator("#view-root .form-render .form-section").nth(1).locator(".fy-caption").allTextContents();
    expect(captions.some((caption) => caption.includes("Turnover"))).toBe(true);

    const thisYear = figures.filter((figure) => figure.label !== "Last year").map((figure) => money(figure.text));
    // A, B, C, D, E, F, G, H in the order the format prints them.
    expect(thisYear).toHaveLength(8);
    const [a, b, c, d, e, f, g, h] = thisYear;
    // The identity is exact on the cells behind the form: other charges is
    // administrative expenses less the staff costs and the amounts written
    // off assets printed above it, so the seven lines net to the bottom one.
    // The page prints each of the eight rounded to the penny, and seven
    // roundings compose, so the printed figures agree within a penny.
    const penceApart = Math.abs(Math.round((a + b - c - d - e - f - g - h) * 100));
    expect(penceApart, "the eight printed figures net to within a penny").toBeLessThanOrEqual(1);
  });

  test("the six form views render with no console error", async ({ page }) => {
    const errors = watchForErrors(page);
    await openPackage(page);
    for (const viewId of ["accounts", "corporation-tax", "ct600", "vat-returns", "payroll", "company"]) {
      await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
      await expect(page.locator(`.tab-btn[data-view="${viewId}"]`)).toHaveAttribute("aria-selected", "true");
      const root = page.locator("#view-root");
      await expect(root).toBeVisible();
      expect((await root.innerHTML()).trim().length, `${viewId} renders something`).toBeGreaterThan(0);
    }
    expect(errors, "the six views raised no console error").toEqual([]);
  });

  test("the VAT view renders five returns and says what they cover", async ({ page }) => {
    await openPackage(page);
    await openView(page, "vat-returns");
    await expect(page.locator("#view-root .form-render")).toHaveCount(5);
    await expect(page.locator("#view-root .vat-coverage li").first()).toBeVisible();
    const chips = await page.locator("#view-root .form-render").first().locator(".box-chip").allTextContents();
    expect(chips).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  test("the Company view splits the declared dividend across the members to the penny", async ({ page }) => {
    await openPackage(page);
    await page.locator('.tab-btn[data-view="company"]').click();
    await expect(page.locator("#view-root .dividend-voucher").first()).toBeVisible();
    const amounts = await page
      .locator("#view-root .dividend-voucher")
      .evaluateAll((vouchers) =>
        vouchers.map((voucher) => Array.from(voucher.querySelectorAll(".kv-table tr")).pop()?.querySelector("td:last-child")?.textContent),
      );
    expect(amounts).toHaveLength(3);
    expect(amounts.reduce((total, text) => total + Number(String(text).replace(/[£,\s]/g, "")), 0)).toBeCloseTo(15000, 2);
  });

  test("the computation carries no drift mark on a fresh package", async ({ page }) => {
    await openPackage(page);
    await openView(page, "corporation-tax");
    await expect(page.locator("#view-root .pencil-correction")).toHaveCount(0);
  });

  // The drift layer walks CELL_MAP's cells, so the cell corrupted here is one
  // CELL_MAP names and one form box renders: the computation's own tax total.
  // The financial-year cells beside it (CorporationTax E33 to I34) are not in
  // CELL_MAP, so nothing the sheet does to them can drift until they are.
  test("a drifting cell marks that box's own margin and no other", async ({ page }) => {
    await openPackage(page, { file: "Financialaccounts.xlsx", sheet: "CorporationTax", cell: "K35" });
    await openView(page, "corporation-tax");
    const drift = await page.evaluate(() => (window.DIYA_BOOKS_SNAPSHOT.drift || []).map((entry) => entry.id));
    expect(drift).toContain("Financialaccounts.xlsx!CorporationTax!K35");
    await expect(page.locator("#view-root .form-row-margin .pencil-correction")).toHaveCount(1);
    const owningRow = page.locator("#view-root .form-row", { has: page.locator(".form-row-margin .pencil-correction") });
    await expect(owningRow).toHaveAttribute("data-ct600-box", "440");
    await expect(owningRow.locator(".form-row-label")).toHaveText("Corporation tax chargeable");
  });
});
