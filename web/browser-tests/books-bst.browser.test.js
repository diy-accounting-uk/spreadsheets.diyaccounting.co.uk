// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd

// web/browser-tests/books-bst.browser.test.js
// Browser tests for the DIYA-GL books page (web/spreadsheets.diyaccounting.co.uk/public/books/bst.html)
// covering the four designed layouts and the download.html entry panel.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "reports/screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });

const bstHtmlUrl = pathToFileURL(path.join(publicDir, "books/bst.html")).href;

const VIEWPORTS = {
  "desktop-landscape": { width: 1440, height: 900 },
  "desktop-portrait": { width: 1024, height: 1366 },
  "mobile-landscape": { width: 844, height: 390 },
  "mobile-portrait": { width: 390, height: 844 },
};

async function openLoadedBook(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(bstHtmlUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached();
}

test.describe("DIYA-GL books page — empty state", () => {
  test("offers the picker, new book and example as the first thing shown", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstHtmlUrl, { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state h2")).toHaveText("View your books in DIYA-GL");
    await expect(page.locator('label[for="file-picker"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Start a new book" })).toBeVisible();
    await expect(page.getByRole("button", { name: /bst-scenario-basic/ })).toBeVisible();

    // Sheet tabs and inspector are not shown before a book is loaded.
    await expect(page.locator("#sheet-tabs")).toHaveClass(/hidden/);
  });

  test("rejects .xls with instructions, does not pretend to read it", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstHtmlUrl, { waitUntil: "domcontentloaded" });

    const buffer = Buffer.from("not a real xls, just bytes for the picker test");
    await page.locator("#file-picker").setInputFiles({
      name: "my-accounts.xls",
      mimeType: "application/vnd.ms-excel",
      buffer,
    });

    await expect(page.locator("#empty-state-message")).toContainText("save as .xlsx");
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

  test("the pencil-correction mark renders wherever the snapshot shows drift", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-landscape"]);
    await page.locator('.tab-btn[data-view="profit-loss"]').click();

    const correction = page.locator(".pencil-correction").first();
    await expect(correction).toBeVisible();
    await expect(correction.locator(".as-read")).toBeVisible();
    await expect(correction.locator(".drift-amount")).toBeVisible();
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
    await expect(page.locator(".form-row-margin .pencil-correction").first()).toBeVisible();
  });
});

test.describe("DIYA-GL books page — four layouts", () => {
  test("desktop landscape: inspector rail beside the year table", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-landscape"]);

    await expect(page.locator("#inspector")).toBeVisible();
    await expect(page.locator("#inspector .checks-list")).toBeVisible();
    await expect(page.locator("#mobile-tabbar")).toBeHidden();
    await expect(page.locator("#drawer-toggle-btn")).toBeHidden();

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-desktop-landscape.png"), fullPage: false });
  });

  test("desktop portrait: inspector collapses to a bottom drawer opened by the toggle", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["desktop-portrait"]);

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

    await expect(page.locator(".year-table-scroll")).toBeVisible();
    await expect(page.locator(".month-cards")).toBeHidden();
    await expect(page.locator("#mobile-tabbar")).toBeVisible();

    const monthCellPosition = await page.locator(".year-table td.month-cell").first().evaluate((el) => getComputedStyle(el).position);
    expect(monthCellPosition).toBe("sticky");
    const monthCellLeft = await page.locator(".year-table td.month-cell").first().evaluate((el) => getComputedStyle(el).left);
    expect(monthCellLeft).toBe("0px");

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-mobile-landscape.png"), fullPage: false });
  });

  test("mobile portrait: stacked month cards with a sticky year-totals header and a bottom action bar", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["mobile-portrait"]);

    await expect(page.locator(".month-cards")).toBeVisible();
    await expect(page.locator(".year-table-scroll")).toBeHidden();
    await expect(page.locator("#mobile-action-bar")).toBeVisible();

    const stickyPosition = await page.locator("#year-summary-sticky").evaluate((el) => getComputedStyle(el).position);
    expect(stickyPosition).toBe("sticky");
    await expect(page.locator("#year-summary-sticky")).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-mobile-portrait.png"), fullPage: false });
  });

  test("mobile Charts tab shows the visualisations, mobile Checks tab opens the drawer without charts", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["mobile-portrait"]);

    await page.locator('.mobile-tab[data-tab="charts"]').click();
    await expect(page.locator("#view-root svg").first()).toBeVisible();

    await page.locator('.mobile-tab[data-tab="checks"]').click();
    await expect(page.locator("#inspector-drawer")).toHaveClass(/is-open/);
    await expect(page.locator("#inspector-drawer .checks-list")).toBeVisible();
    await expect(page.locator("#inspector-drawer svg")).toHaveCount(0);
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
