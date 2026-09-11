// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-measurement.browser.test.js
//
// The GA4 events diya-gl/shell.js sends: a book loaded (with its product and
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
  return `${baseUrl}/diya-gl/bst.html`;
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

// The same link shell.js itself reads off window.DIYA_GL_DONATE_LINK
// (donate-config.js, generated per environment by
// scripts/build-donate-page.mjs) -- read back from the page rather than
// copied here, so this spec cannot drift from what the page actually loaded.
async function donateStripeLink(page) {
  return page.evaluate(() => window.DIYA_GL_DONATE_LINK);
}

test.describe("DIYA-GL page — measurement", () => {
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
    await expect(donateLink).toHaveAttribute("href", await donateStripeLink(page));
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
