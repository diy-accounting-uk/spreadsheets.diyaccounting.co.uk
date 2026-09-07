// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-measurement.browser.test.js
//
// The GA4 events books/shell.js sends: a book loaded (with its product and
// source kind), a save (with its format) and the two donation prompts
// (figures, save), each shown once and again when its Stripe link is
// followed. analytics.js's own local gtag() always queues onto
// window.dataLayer, whether or not the remote gtag.js reached
// googletagmanager.com, so reading that array back is the same signal a
// browser's own network tab would show.

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

// A clean localStorage with analytics consent already granted, so the
// cookie banner never covers the page and every trackEvent call queues
// onto dataLayer for the test to read back.
test.beforeEach(async ({ page }) => {
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem("consent.analytics", "granted");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
});

async function loadExample(page) {
  await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function triggerSave(page, menuItemName) {
  await page.click("#save-btn");
  const item = page.getByRole("menuitem", { name: menuItemName, exact: true });
  await item.waitFor({ state: "visible" });
  await Promise.all([page.waitForEvent("download"), item.click()]);
}

function gaEvents(page, eventName) {
  return page.evaluate(
    (name) => (window.dataLayer || []).filter((entry) => entry[0] === "event" && entry[1] === name).map((entry) => entry[2]),
    eventName,
  );
}

test.describe("DIYA-GL books page — measurement", () => {
  test("loading an example sends book_loaded with the product and the example source", async ({ page }) => {
    await loadExample(page);

    const events = await gaEvents(page, "book_loaded");
    expect(events).toEqual([{ product: "bst", source: "example" }]);
  });

  test("a save sends book_saved with the product and the chosen format", async ({ page }) => {
    await loadExample(page);
    await triggerSave(page, "Download books as JSON (.json)");
    await expect(page.locator("#toast")).toContainText("Saved ", { timeout: 30_000 });

    const events = await gaEvents(page, "book_saved");
    expect(events).toEqual([{ product: "bst", format: "json" }]);
  });

  test("the figures donation prompt sends donation_prompt shown, then followed on its Stripe link", async ({ page }) => {
    await loadExample(page);

    let events = await gaEvents(page, "donation_prompt");
    expect(events).toEqual([{ prompt: "figures", action: "shown" }]);

    const prompt = page.locator("#donation-prompt-figures");
    await expect(prompt).toBeVisible();
    const donateLink = prompt.locator("a.btn-primary");
    await expect(donateLink).toHaveAttribute("href", DONATE_STRIPE_LINK);
    await donateLink.click();

    events = await gaEvents(page, "donation_prompt");
    expect(events).toEqual([
      { prompt: "figures", action: "shown" },
      { prompt: "figures", action: "followed" },
    ]);
  });

  test("the save donation prompt sends donation_prompt shown after a save completes", async ({ page }) => {
    await loadExample(page);
    await triggerSave(page, "Download books as diya-gl (.zip)");
    await expect(page.locator("#toast")).toContainText("Saved ", { timeout: 30_000 });

    const events = await gaEvents(page, "donation_prompt");
    expect(events).toContainEqual({ prompt: "save", action: "shown" });
  });
});
