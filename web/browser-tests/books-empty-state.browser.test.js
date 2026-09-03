// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-empty-state.browser.test.js
//
// The books page's two leftovers from the data model (PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md):
// the new-book form (the second way in -- an empty but valid book from a
// short form) and IndexedDB autosave of the working book (survives a closed
// tab, offered back on return, never loaded silently).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "reports/screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });

const VIEWPORTS = {
  "desktop-landscape": { width: 1440, height: 900 },
};

// A real HTTP origin, exactly like books-bst.browser.test.js: the engine's
// resource loader fetches schemas and tax data from site-absolute paths, and
// IndexedDB itself is scoped to an origin -- a file:// page has neither.
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

test.describe("DIYA-GL books page — new-book form", () => {
  test("the form creates and renders an empty, honest book", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Start a new book" }).click();
    await expect(page.locator("#new-book-form")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, "books-new-book-form.png"), fullPage: false });

    await page.locator("#new-book-name").fill("Acorn Trading");
    await page.locator("#new-book-year-end").fill("2026-03-31");
    await page.getByRole("button", { name: "Create book" }).click();

    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    await expect(page.locator("#app-title")).toContainText("Acorn Trading");

    // Twelve month rows, the year totals row reading zero -- an empty book
    // renders honestly, not as a blank page.
    await expect(page.locator(".year-table tbody tr.year-row")).toHaveCount(12);
    await expect(page.locator(".year-totals td").first()).toContainText("£0.00");

    // No as-read layer to compare against, so no drift is possible, and
    // every check on a book with no lines to fail passes.
    const snapshot = await page.evaluate(() => {
      const s = window.DIYA_BST_SNAPSHOT;
      return {
        driftCount: s.drift.length,
        checksFailing: s.checks.filter((c) => c.result !== "pass").length,
        checksTotal: s.checks.length,
        hasBook: !!s.book,
        linesCount: s.lines.length,
        sourceKind: s.source && s.source.kind,
      };
    });
    expect(snapshot.driftCount).toBe(0);
    expect(snapshot.checksFailing).toBe(0);
    expect(snapshot.checksTotal).toBeGreaterThan(0);
    expect(snapshot.hasBook).toBe(true);
    expect(snapshot.linesCount).toBe(0);
    expect(snapshot.sourceKind).toBe("new");
  });

  test("an empty submission shows validation errors in the page's own styling", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Start a new book" }).click();
    await page.getByRole("button", { name: "Create book" }).click();

    const error = page.locator("#new-book-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveClass(/upload-error/);
    await expect(error).toContainText("business name");
    await expect(error).toContainText("year-end date");

    // The page stays on the form, not a stack trace or a dead end.
    await expect(page.locator("#new-book-form")).toBeVisible();
  });
});

test.describe("DIYA-GL books page — IndexedDB autosave", () => {
  test("a loaded book survives a reload via the continue offer; discard clears it", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    // No offer before anything has ever been loaded.
    await expect(page.locator(".continue-offer")).toHaveCount(0);

    await page.getByRole("button", { name: /bst-sp-sixty/ }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    // A closed-tab-and-back is a reload against the same origin: the working
    // book was never uploaded anywhere, but it survives locally.
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    const offer = page.locator(".continue-offer");
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await expect(offer).toContainText(/sp-sixty/);
    // The fresh options are still offered alongside it -- never a fork the
    // reader must resolve before doing anything else.
    await expect(page.getByRole("button", { name: "Start a new book" })).toBeVisible();
    await expect(page.getByRole("button", { name: /bst-scenario-basic/ })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, "books-continue-offer.png"), fullPage: false });

    // It never loads on its own -- only the explicit Continue click does.
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);

    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    await expect(page.locator("#app-title")).toContainText("SP Sixty");

    // Reload again, then discard: the offer is gone for good, not just for
    // this page view.
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".continue-offer")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.locator(".continue-offer")).toHaveCount(0);

    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".continue-offer")).toHaveCount(0);
  });

  test("a broken IndexedDB degrades to no-autosave without breaking the page", async ({ page }) => {
    // Simulate a blocked/unavailable store: indexedDB.open always throws.
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        configurable: true,
        get() {
          return {
            open() {
              throw new Error("IndexedDB unavailable in this simulated environment");
            },
          };
        },
      });
    });

    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state h2")).toHaveText("View your books in DIYA-GL");
    await expect(page.locator(".continue-offer")).toHaveCount(0);

    await page.getByRole("button", { name: /bst-sp-sixty/ }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    expect(consoleErrors, "a broken IndexedDB never raises an uncaught page error").toEqual([]);
  });
});
