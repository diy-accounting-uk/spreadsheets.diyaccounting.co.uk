// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd

// web/browser-tests/books-bst.browser.test.js
// Browser tests for the DIYA-GL books page (web/spreadsheets.diyaccounting.co.uk/public/books/bst.html)
// covering the four designed layouts, the download.html entry panel, and (W1)
// the live upload path: extraction, the as-read drift layer and its
// breakability proof.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "reports/screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });

const FRESH_PACKAGE_PATH = path.join(process.cwd(), "examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx");

const VIEWPORTS = {
  "desktop-landscape": { width: 1440, height: 900 },
  "desktop-portrait": { width: 1024, height: 1366 },
  "mobile-landscape": { width: 844, height: 390 },
  "mobile-portrait": { width: 390, height: 844 },
};

// The engine's own resource loader fetches the schemas and the tax year data
// from site-absolute paths (/schema/, /books/assets/), so the page needs a
// real HTTP origin to load against -- a file:// navigation has no origin for
// fetch() to resolve those against. serve.js sends production's security
// headers, so an eval-dependent bundle fails here the way it fails in prod.
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

function bstUrl() {
  return `${baseUrl}/books/bst.html`;
}

async function openLoadedBook(page, viewport, exampleName = /bst-scenario-basic/) {
  await page.setViewportSize(viewport);
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: exampleName }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

// The strip sits above the year table in the document regardless of which
// of the two the current viewport actually shows -- mobile portrait hides
// .year-table-scroll in favour of .month-cards, but both are always in the
// DOM, so document order alone proves "above" at every layout.
async function expectStripAboveYearTable(page) {
  await expect(page.locator(".headlines-strip")).toBeAttached();
  const stripPrecedesTable = await page.evaluate(() => {
    const strip = document.querySelector(".headlines-strip");
    const table = document.querySelector(".year-table-scroll");
    return !!(strip && table && strip.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(stripPrecedesTable).toBe(true);
}

async function uploadFile(page, buffer, name) {
  await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await page.locator("#file-picker").setInputFiles({
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
}

// ── Workbook corruption helpers, for the breakability proof ────────────────
// Mirror the OOXML mechanics books/xlsx-cells.js reads with: find a sheet's
// XML by name through workbook.xml + its rels, then edit one cell in place.

async function sheetPathByName(zip, sheetName) {
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const tag = [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)].find((m) => m[1].includes(`name="${sheetName}"`));
  if (!tag) throw new Error(`sheet "${sheetName}" not found in the fixture workbook`);
  const rid = /r:id="([^"]+)"/.exec(tag[1])[1];
  const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(relsXml)[1];
  return `xl/${target}`;
}

// Corrupts exactly one cached formula value, leaving the formula and every
// other cell untouched -- the point being that R (computed from the
// extracted lines) never reads this cell at all, so only its own as-read
// comparison can move.
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

// Renames a sheet the anchor guard requires, so BstAnchorError's
// "sheet not found" branch fires -- a customer's file that does not match
// the current Basic Sole Trader template, not a parse failure.
async function withRenamedSheet(sourcePath, oldName, newName) {
  const zip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const patched = workbookXml.replace(`name="${oldName}"`, `name="${newName}"`);
  expect(patched, "the sheet name to rename was found in workbook.xml").not.toBe(workbookXml);
  zip.file("xl/workbook.xml", patched);
  return zip.generateAsync({ type: "nodebuffer" });
}

test.describe("DIYA-GL books page — empty state", () => {
  test("offers the picker, new book and every example as the first thing shown", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state h2")).toHaveText("View your books in DIYA-GL");
    await expect(page.locator('label[for="file-picker"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Start a new book" })).toBeVisible();
    await expect(page.getByRole("button", { name: /bst-scenario-basic/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /bst-brickwork-pro-nonvat/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /bst-sp-sixty/ })).toBeEnabled();

    // Sheet tabs and inspector are not shown before a book is loaded.
    await expect(page.locator("#sheet-tabs")).toHaveClass(/hidden/);
  });

  test("rejects .xls with instructions, does not pretend to read it", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    const buffer = Buffer.from("not a real xls, just bytes for the picker test");
    await page.locator("#file-picker").setInputFiles({
      name: "my-accounts.xls",
      mimeType: "application/vnd.ms-excel",
      buffer,
    });

    await expect(page.locator("#empty-state-message")).toContainText("save as .xlsx");
  });

  test("the other two example books load live, not just bst-scenario-basic", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-landscape"], /bst-brickwork-pro-nonvat/);
    await expect(page.locator("#app-title")).toContainText("BrickWork");

    await openLoadedBook(page, VIEWPORTS["desktop-landscape"], /bst-sp-sixty/);
    await expect(page.locator(".year-table tbody tr.year-row")).toHaveCount(12);
  });

  test("an anchor mismatch fails by name, in the page's own error styling, not a stack trace", async ({ page }) => {
    const corrupted = await withRenamedSheet(FRESH_PACKAGE_PATH, "Admin", "Admin (renamed)");
    await uploadFile(page, corrupted, "renamed-sheet.xlsx");

    const message = page.locator("#empty-state-message");
    await expect(message).toHaveClass(/upload-error/);
    // Exactly the named-anchor message and nothing else -- never a stack
    // trace, never a generic "something went wrong".
    await expect(message).toHaveText('This file does not match the current Basic Sole Trader template:\n  - sheet "Admin" not found');
  });
});

test.describe("DIYA-GL books page — loaded views", () => {
  test("year table shows twelve months, category columns and an anchored totals row", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-landscape"]);

    const rows = page.locator(".year-table tbody tr.year-row");
    await expect(rows).toHaveCount(12);

    const totals = page.locator("tfoot.year-totals td").first();
    await expect(totals).toBeVisible();
    await expect(page.locator("tfoot.year-totals")).toContainText("£409,900.00");
  });

  test("a month expands to its summary, then to its entries, one at a time", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-landscape"]);

    const aprilRow = page.locator('.year-row[data-month="2025-04"]');
    await expect(aprilRow).toHaveAttribute("aria-expanded", "true"); // April opens by default

    const mayRow = page.locator('.year-row[data-month="2025-05"]');
    await mayRow.click();
    await expect(mayRow).toHaveAttribute("aria-expanded", "true");
    await expect(aprilRow).toHaveAttribute("aria-expanded", "false");

    // Only one month's detail panel exists at a time.
    await expect(page.locator(".month-detail-row")).toHaveCount(1);

    // Reopen April, the month the fixture carries real entries for.
    await aprilRow.click();
    await expect(aprilRow).toHaveAttribute("aria-expanded", "true");
    const entriesToggle = page.locator("#entries-toggle");
    await expect(entriesToggle).toContainText("Show entries");
    await entriesToggle.click();
    await expect(page.locator("table.entries-table")).toHaveCount(2);
  });

  test("SA103S and Income Tax tax-form renders show box-number chips and no HMRC branding", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-landscape"]);

    await page.locator('.tab-btn[data-view="sa103s"]').click();
    await expect(page.locator(".form-render .form-name")).toHaveText(/SA103S/);
    await expect(page.locator(".box-chip").first()).toBeVisible();
    await expect(page.locator(".whole-pounds-note").first()).toHaveText("whole pounds");
    const sa103sHtml = await page.locator(".form-render").innerHTML();
    expect(sa103sHtml.toLowerCase()).not.toContain("gov.uk");
    expect(sa103sHtml.toLowerCase()).not.toContain("hmrc logo");

    await page.locator('.tab-btn[data-view="income-tax"]').click();
    await expect(page.locator(".form-render .form-name")).toHaveText(/Income Tax/);
    await expect(page.locator(".form-row.total-row").first()).toBeVisible();
  });

  test("the Debtors & Creditors view renders the sheet the template ships", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-landscape"]);
    await page.locator('.tab-btn[data-view="debtors-creditors"]').click();

    // One opening figure a side, then a row per month, then the column total
    // -- no customer or supplier named, because the sheet names none.
    const debtors = page.locator(".panel-card", { hasText: "Debtors" }).first();
    await expect(debtors).toContainText("Owed by customers at start of year");
    await expect(debtors).toContainText("£10,800.00");
    await expect(debtors.locator("tr")).toHaveCount(14); // opening + twelve months + total
    await expect(debtors).toContainText("Amount owed by customers");

    const creditors = page.locator(".panel-card", { hasText: "Creditors" }).first();
    await expect(creditors).toContainText("Owed to suppliers at start of year");
    await expect(creditors).toContainText("£2,220.00");
  });

  test("checks panel shows live pass/fail verdicts from the engine", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-landscape"]);
    await expect(page.locator("#inspector .check-item")).not.toHaveCount(0);
    await expect(page.locator("#inspector .check-item.fail")).toHaveCount(0);
  });
});

test.describe("DIYA-GL books page — the rung: upload, drift, breakability", () => {
  test("a freshly generated package uploaded shows zero drift", async ({ page }) => {
    await uploadFile(page, fs.readFileSync(FRESH_PACKAGE_PATH), "GB_Accounts_Basic_Sole_Trader.xlsx");
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    // The whole of the snapshot's own drift collection, not just the three
    // views this test happens to visit -- a finding on a view nobody clicked
    // would otherwise pass silently.
    const drift = await page.evaluate(() => window.DIYA_BST_SNAPSHOT.drift);
    expect(drift).toEqual([]);

    await expect(page.locator("#app-title")).toContainText("Precision Code Trading");
    await expect(page.locator(".pencil-correction")).toHaveCount(0);

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator(".pencil-correction")).toHaveCount(0);
    await expect(page.locator(".kv-table")).toContainText("£7,598.00"); // Motor Expenses, plain, no correction
  });

  test("a hand-corrupted cached value shows exactly that cell's drift, nothing else", async ({ page }) => {
    const corrupted = await corruptedCachedValue(FRESH_PACKAGE_PATH, "Income Tax", "E11", "99999");
    await uploadFile(page, corrupted, "corrupted-income-tax.xlsx");
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    // The corrupted cell's own view carries the pencil correction: the
    // computed figure in ink, the workbook's (corrupted) cached figure struck
    // through beneath it, signed drift beside it.
    await page.locator('.tab-btn[data-view="income-tax"]').click();
    const correction = page.locator(".form-row-margin .pencil-correction");
    await expect(correction).toHaveCount(1);
    await expect(correction.locator(".as-read")).toContainText("99,999");
    await expect(correction.locator(".computed-value")).toContainText("88,131.60");
    await expect(correction.locator(".drift-amount")).toContainText("11867.40");

    // Nothing else on the P&L or SA103S views picked up a correction: the
    // computed side never reads the workbook's cells at all, so corrupting
    // one cached value moves only its own comparison.
    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator(".pencil-correction")).toHaveCount(0);
    await page.locator('.tab-btn[data-view="sa103s"]').click();
    await expect(page.locator(".pencil-correction")).toHaveCount(0);
  });
});

test.describe("DIYA-GL books page — four layouts", () => {
  test("desktop landscape: inspector rail beside the year table", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-landscape"]);
    await expectStripAboveYearTable(page);

    await expect(page.locator("#inspector")).toBeVisible();
    await expect(page.locator("#inspector .checks-list")).toBeVisible();
    await expect(page.locator("#mobile-tabbar")).toBeHidden();
    await expect(page.locator("#drawer-toggle-btn")).toBeHidden();

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-desktop-landscape.png"), fullPage: false });
  });

  test("desktop portrait: inspector collapses to a bottom drawer opened by the toggle", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-portrait"]);
    await expectStripAboveYearTable(page);

    await expect(page.locator("#inspector")).toBeHidden();
    await expect(page.locator("#drawer-toggle-btn")).toBeVisible();
    await expect(page.locator("#inspector-drawer")).not.toHaveClass(/is-open/);

    await page.locator("#drawer-toggle-btn").click();
    await expect(page.locator("#inspector-drawer")).toHaveClass(/is-open/);
    await expect(page.locator("#inspector-drawer .checks-list")).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-desktop-portrait.png"), fullPage: false });
  });

  test("mobile landscape: the columnar table scrolls horizontally with the month column frozen", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["mobile-landscape"]);
    await expectStripAboveYearTable(page);

    await expect(page.locator(".year-table-scroll")).toBeVisible();
    await expect(page.locator(".month-cards")).toBeHidden();
    await expect(page.locator("#mobile-tabbar")).toBeVisible();

    const monthCellPosition = await page
      .locator(".year-table td.month-cell")
      .first()
      .evaluate((el) => getComputedStyle(el).position);
    expect(monthCellPosition).toBe("sticky");
    const monthCellLeft = await page
      .locator(".year-table td.month-cell")
      .first()
      .evaluate((el) => getComputedStyle(el).left);
    expect(monthCellLeft).toBe("0px");

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-mobile-landscape.png"), fullPage: false });
  });

  test("mobile portrait: stacked month cards with a sticky year-totals header and a bottom action bar", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["mobile-portrait"]);
    await expectStripAboveYearTable(page);

    await expect(page.locator(".month-cards")).toBeVisible();
    await expect(page.locator(".year-table-scroll")).toBeHidden();
    await expect(page.locator("#mobile-action-bar")).toBeVisible();

    const stickyPosition = await page.locator("#year-summary-sticky").evaluate((el) => getComputedStyle(el).position);
    expect(stickyPosition).toBe("sticky");
    await expect(page.locator("#year-summary-sticky")).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-mobile-portrait.png"), fullPage: false });
  });

  test("mobile portrait: the headlines strip leads the Books tab; the Checks tab opens the drawer without it", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["mobile-portrait"]);

    const firstChildId = await page.locator("#view-root > *").first().getAttribute("id");
    expect(firstChildId).toBe("headlines-strip-mount");
    await expect(page.locator("#view-root .headline-tiles [data-r-key^='headline/']")).toHaveCount(4);

    await page.locator('.mobile-tab[data-tab="checks"]').click();
    await expect(page.locator("#inspector-drawer")).toHaveClass(/is-open/);
    await expect(page.locator("#inspector-drawer .checks-list")).toBeVisible();
    await expect(page.locator("#inspector-drawer .headlines-strip")).toHaveCount(0);
  });
});

test.describe("Spreadsheets download.html — DIYA-GL entry panel", () => {
  function readHtml(filename) {
    return fs.readFileSync(path.join(publicDir, filename), "utf-8");
  }

  test("has the View your books in DIYA-GL panel linking to books/bst.html", async ({ page }) => {
    await page.setContent(readHtml("download.html"), { waitUntil: "domcontentloaded" });

    const heading = page.locator("h2", { hasText: "View your books in DIYA-GL" });
    await expect(heading).toBeVisible();

    const section = page.locator(".download-section", { has: heading });
    await expect(section).toContainText("Nothing is uploaded");

    const link = section.locator("#books-bst-link");
    await expect(link).toHaveAttribute("href", "books/bst.html");
    await expect(link).toHaveText("View in DIYA-GL");

    // No file picker on this panel -- the books page owns it.
    await expect(section.locator("input[type=file]")).toHaveCount(0);
  });
});
