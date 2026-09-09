// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/books-ltd-deep-links.browser.test.js
//
// The books page's ?example=/&view=/&month= deep links, over books/ltd.html:
// the same shell (shell.js) that drives books-deep-links.browser.test.js for
// BST, unchanged, so a link loads one of the three Ltd example books on
// arrival, lands on a view or an open month, and keeps the URL current as
// the reader moves around -- without ever touching the IndexedDB autosave
// record.
//
// The Ltd manifest does not carry a "ct600" view yet, so the view-landing
// case below lands on "profit-loss", a view the manifest does carry.

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

function ltdUrl(search) {
  return `${baseUrl}/books/ltd.html${search || ""}`;
}

const EXAMPLES = [
  { key: "ltd-scenario-full", name: "Precision Code Ltd" },
  { key: "ltd-brickwork-pro-vat", name: "BrickWork Pro Ltd" },
  { key: "ltd-brickwork-pro-nonvat", name: "BrickWork Pro Ltd" },
];

test.describe("DIYA-GL books page — Ltd deep links load an example on arrival", () => {
  test("each ?example= loads its book straight away", async ({ page }) => {
    for (const example of EXAMPLES) {
      await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
      await page.goto(ltdUrl(`?example=${example.key}`), { waitUntil: "domcontentloaded" });

      await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
      await expect(page.locator("#app-title")).toContainText(example.name);
      // A link never shows the file picker's own empty-state card.
      await expect(page.locator(".empty-state")).toHaveCount(0);
    }
  });

  test("&view=profit-loss lands on the Profit & Loss view once the book has loaded", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(ltdUrl("?example=ltd-scenario-full&view=profit-loss"), { waitUntil: "domcontentloaded" });

    await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await expect(page.locator("#view-root")).not.toBeEmpty();
  });

  test("&month=2025-06 opens June, with its entries, in the year view", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(ltdUrl("?example=ltd-scenario-full&month=2025-06"), { waitUntil: "domcontentloaded" });

    const juneRow = page.locator('.year-row[data-month="2025-06"]');
    await expect(juneRow).toHaveAttribute("aria-expanded", "true", { timeout: 30_000 });
    await expect(page.locator(".month-detail-row")).toHaveCount(1);
  });

  test("an unknown example id shows the empty state and names the three known ones", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(ltdUrl("?example=nope"), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state")).toBeVisible();
    const message = page.locator("#empty-state-message");
    await expect(message).toContainText("ltd-scenario-full");
    await expect(message).toContainText("ltd-brickwork-pro-vat");
    await expect(message).toContainText("ltd-brickwork-pro-nonvat");
  });

  test("clicking a tab after a link load updates the URL to match", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(ltdUrl("?example=ltd-scenario-full"), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => new URL(page.url()).search).toContain("view=profit-loss");
    await expect.poll(() => new URL(page.url()).search).toContain("example=ltd-scenario-full");
  });

  test("an uploaded or new book never gets an example id written into the URL", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(ltdUrl(), { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Start a new book" }).click();
    await page.locator("#new-book-name").fill("Acorn Trading Ltd");
    await page.locator("#new-book-year-end").fill("2026-03-31");
    await page.getByRole("button", { name: "Create book" }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).search).toBe("");
  });
});
