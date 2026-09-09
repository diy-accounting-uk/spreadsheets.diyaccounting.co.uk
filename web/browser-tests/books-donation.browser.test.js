// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/books-donation.browser.test.js
//
// The two donation nudges books/shell.js shows: one the first time the year
// view renders a loaded book's real figures, one after a save completes.
// Both are corner cards, both link the same Stripe donation buy.stripe.com
// donate.html carries, and both are gated on a localStorage flag so a
// browser sees each at most once, ever.

import { test, expect } from "@playwright/test";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const PUBLIC_DIR = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const DONATE_STRIPE_LINK = "https://buy.stripe.com/5kQ7sK49X9bie0N0bN4F200";

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

function bstUrl() {
  return `${baseUrl}/books/bst.html`;
}

// Every test starts from a clean localStorage: navigate once, clear it, then
// reload so the page's own scripts run against an empty store.
test.beforeEach(async ({ page }) => {
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
});

async function loadExample(page) {
  await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

// Loading an example writes it into the URL as a deep link (books/shell.js's
// syncDeepLinkUrl), so a plain reload boots the same book straight back up
// through bootFromDeepLink -- no example button to click, and none of the
// empty state's own async continue-offer race to wait out.
async function reloadLoadedBook(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

// The same #save-btn / role=menuitem path a reader clicks, waiting out the
// real download the click triggers so the test does not hang on it.
async function triggerSave(page, menuItemName) {
  await page.click("#save-btn");
  const item = page.getByRole("menuitem", { name: menuItemName, exact: true });
  await item.waitFor({ state: "visible" });
  await Promise.all([page.waitForEvent("download"), item.click()]);
}

test.describe("DIYA-GL books page — the figures donation prompt", () => {
  test("appears once the year view first shows a loaded book's figures, links the Stripe donation, and stays gone across a reload once dismissed", async ({
    page,
  }) => {
    await expect(page.locator("#donation-prompt-figures")).toHaveCount(0);

    await loadExample(page);

    const prompt = page.locator("#donation-prompt-figures");
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("DIYA-GL is free to use");

    const donateLink = prompt.locator("a.btn-primary");
    await expect(donateLink).toHaveAttribute("href", DONATE_STRIPE_LINK);
    await expect(donateLink).toHaveAttribute("target", "_blank");
    await expect(donateLink).toHaveAttribute("rel", "noopener");

    await prompt.locator(".donation-prompt-dismiss").click();
    await expect(prompt).toHaveCount(0);

    // A reload -- the localStorage flag survives it -- does not bring the
    // prompt back, even once the year view renders the same figures again.
    await reloadLoadedBook(page);
    await expect(page.locator("#donation-prompt-figures")).toHaveCount(0);
  });

  test("does not appear before a book is loaded", async ({ page }) => {
    await expect(page.locator("#donation-prompt-figures")).toHaveCount(0);
  });
});

test.describe("DIYA-GL books page — the save donation prompt", () => {
  test("appears once a save completes, links the Stripe donation, and does not return on a later save", async ({ page }) => {
    await loadExample(page);
    await expect(page.locator("#donation-prompt-save")).toHaveCount(0);

    await triggerSave(page, "Download books as JSON (.json)");
    await expect(page.locator("#toast")).toContainText("Saved ", { timeout: 30_000 });

    const prompt = page.locator("#donation-prompt-save");
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("please consider a donation");

    const donateLink = prompt.locator("a.btn-primary");
    await expect(donateLink).toHaveAttribute("href", DONATE_STRIPE_LINK);
    await expect(donateLink).toHaveAttribute("rel", "noopener");

    await prompt.locator(".donation-prompt-dismiss").click();
    await expect(prompt).toHaveCount(0);

    await triggerSave(page, "Download books as JSON (.json)");
    await expect(page.locator("#toast")).toContainText("Saved ", { timeout: 30_000 });
    await expect(page.locator("#donation-prompt-save")).toHaveCount(0);
  });

  test("a reload after a save does not bring the prompt back", async ({ page }) => {
    await loadExample(page);
    await triggerSave(page, "Download books as diya-gl (.zip)");
    await expect(page.locator("#toast")).toContainText("Saved ", { timeout: 30_000 });
    await expect(page.locator("#donation-prompt-save")).toBeVisible();

    await reloadLoadedBook(page);
    await triggerSave(page, "Download books as diya-gl (.zip)");
    await expect(page.locator("#toast")).toContainText("Saved ", { timeout: 30_000 });
    await expect(page.locator("#donation-prompt-save")).toHaveCount(0);
  });
});
