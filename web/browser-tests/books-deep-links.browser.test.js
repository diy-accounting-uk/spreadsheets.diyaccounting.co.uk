// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-deep-links.browser.test.js
//
// The books page's ?example=/&view=/&month= deep links (PLAN_DIYA_GL_BST_CLI_MCP_WEB.md,
// T16): a link loads one of the three example books on arrival, lands on a
// view or an open month, and keeps the URL current as the reader moves
// around -- without ever touching the IndexedDB autosave record.

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

function bstUrl(search) {
  return `${baseUrl}/books/bst.html${search || ""}`;
}

const EXAMPLES = [
  { key: "bst-scenario-basic", name: "Precision Code Trading" },
  { key: "bst-brickwork-pro-nonvat", name: "BrickWork Pro Trading" },
  { key: "bst-sp-sixty", name: "SP Sixty Driving" },
];

test.describe("DIYA-GL books page — deep links load an example on arrival", () => {
  for (const example of EXAMPLES) {
    test(`?example=${example.key} loads ${example.name} straight away`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
      await page.goto(bstUrl(`?example=${example.key}`), { waitUntil: "domcontentloaded" });

      await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
      await expect(page.locator("#app-title")).toContainText(example.name);
      // A link never shows the file picker's own empty-state card.
      await expect(page.locator(".empty-state")).toHaveCount(0);
    });
  }

  test("&view=income-tax lands on the Income Tax view once the book has loaded", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?example=bst-scenario-basic&view=income-tax"), { waitUntil: "domcontentloaded" });

    await expect(page.locator('.tab-btn[data-view="income-tax"]')).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await expect(page.locator(".form-render .form-name")).toHaveText(/Income Tax/);
  });

  test("&month=2025-06 opens June, with its entries, in the year view", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?example=bst-scenario-basic&month=2025-06"), { waitUntil: "domcontentloaded" });

    const juneRow = page.locator('.year-row[data-month="2025-06"]');
    await expect(juneRow).toHaveAttribute("aria-expanded", "true", { timeout: 30_000 });
    await expect(page.locator(".month-detail-row")).toHaveCount(1);
    // The month opens with its entries already showing, not collapsed.
    await expect(page.locator("#entries-toggle")).toContainText("Hide entries");
    await expect(page.locator("table.entries-table").first()).toBeVisible();
  });

  test("an unknown example id shows the empty state and names the three known ones", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?example=nope"), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state")).toBeVisible();
    const message = page.locator("#empty-state-message");
    await expect(message).toContainText("bst-scenario-basic");
    await expect(message).toContainText("bst-brickwork-pro-nonvat");
    await expect(message).toContainText("bst-sp-sixty");
  });

  test("?view=stock alone, with no example, leaves the empty state untouched", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?view=stock"), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state")).toBeVisible();
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);
    await expect(page.locator("#empty-state-message")).toHaveText("");
  });

  test("clicking the P&L tab after a link load updates the URL to match", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?example=bst-scenario-basic"), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => new URL(page.url()).search).toContain("view=profit-loss");
    await expect.poll(() => new URL(page.url()).search).toContain("example=bst-scenario-basic");
  });

  test("an uploaded or new book never gets an example id written into the URL", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Start a new book" }).click();
    await page.locator("#new-book-name").fill("Acorn Trading");
    await page.locator("#new-book-year-end").fill("2026-03-31");
    await page.getByRole("button", { name: "Create book" }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).search).toBe("");
  });
});

test.describe("DIYA-GL books page — a deep link never touches the autosave record", () => {
  test("a link arrival shows no continue offer and leaves a saved book alone", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);

    // Seed an autosave record the ordinary way: load an example through its
    // own button, exactly as books-empty-state.browser.test.js does.
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-sp-sixty/ }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    // A link arrival for a different example: no continue offer appears,
    // and it loads its own book rather than the saved one.
    await page.goto(bstUrl("?example=bst-scenario-basic"), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    await expect(page.locator(".continue-offer")).toHaveCount(0);
    await expect(page.locator("#app-title")).toContainText("Precision Code Trading");

    // A later plain arrival still offers the original saved book -- the
    // link never overwrote it.
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    const offer = page.locator(".continue-offer");
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await expect(offer).toContainText(/sp-sixty/);
  });
});
