// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-home.browser.test.js
//
// The DIYA-GL homepage, index.html: the Ltd page's shell booting its own
// default example (body[data-default-example], -view and -month) under the
// home strip. The example loads with real figures at the year view with
// April 2025 open and the address bar stays bare; a saved working book is
// offered as a banner over it; the URL's own ?example= still wins over the
// attributes; and the tier strip's resident line appears only once the
// account list reports the tier.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/diya-gl.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "reports/screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });

const DESKTOP_LANDSCAPE = { width: 1440, height: 900 };
const PROD_API_BASE = "https://submit.diyaccounting.co.uk/api/v1";

let closeServer;
let baseUrl;

test.beforeAll(async () => {
  const server = await startStaticServer(publicDir, path.join(process.cwd(), "infra/main/resources/diya-gl-security-headers.json"));
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer();
});

function homeUrl(search) {
  return `${baseUrl}/index.html${search || ""}`;
}

function money(text) {
  return Number(String(text).replace(/[£,\s]/g, ""));
}

async function expectExampleLoaded(page) {
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
  await expect(page.locator("#app-title")).toContainText("BrickWork Pro Ltd");
}

// Seeds the autosave record the ordinary way: a different Ltd example loaded
// through its own button on ltd.html, which writes the working book.
async function seedSavedBook(page) {
  await page.goto(`${baseUrl}/ltd.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /ltd-scenario-full/ }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
  await expect
    .poll(() => page.evaluate(() => window.DiyaGlAutosave.loadWorkingBook().then((record) => record && record.source.label)))
    .toBe("ltd-scenario-full");
}

async function withTestClientId(page) {
  await page.addInitScript(() => {
    window.DIYA_GL_CLOUD_TEST_CLIENT_ID = "test-diya-gl-client";
  });
}

// A signed-in tab without the OAuth exchange: the sessionStorage keys
// cloud.js's processPendingReturn() would have written.
async function withSignedInSession(page) {
  await page.addInitScript(() => {
    function b64url(obj) {
      const json = JSON.stringify(obj);
      const base64 = btoa(unescape(encodeURIComponent(json)));
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    var claims = { sub: "user-1", email: "reader@example.com" };
    var idToken = b64url({ alg: "none" }) + "." + b64url(claims) + ".sig";
    window.sessionStorage.setItem("diya-gl.cloud.idToken", idToken);
    window.sessionStorage.setItem("diya-gl.cloud.accessToken", "access-1");
    window.sessionStorage.setItem("diya-gl.cloud.refreshToken", "refresh-1");
    window.sessionStorage.setItem("diya-gl.cloud.expiresAt", String(Date.now() + 3600_000));
    window.sessionStorage.setItem("diya-gl.cloud.user", JSON.stringify(claims));
  });
}

async function withBooksList(page, entitlement) {
  await page.route(`${PROD_API_BASE}/books`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ books: [], entitlement }),
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
});

test.describe("DIYA-GL homepage — the Ltd example boots on arrival", () => {
  test("loads BrickWork Pro Ltd at the year view with April 2025 open, figures showing and a bare address", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(homeUrl(), { waitUntil: "domcontentloaded" });
    await expectExampleLoaded(page);
    await expect(page.locator(".empty-state")).toHaveCount(0);

    await expect(page.locator('.tab-btn[data-view="year"]')).toHaveAttribute("aria-selected", "true");
    const april = page.locator('.year-row[data-month="2025-04"]');
    await expect(april).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".month-detail-row")).toHaveCount(1);

    const salesTotal = page.locator('.year-totals [data-r-key*="MnthP&L!B9"]').first();
    await expect(salesTotal).toBeVisible();
    expect(money(await salesTotal.textContent())).toBeGreaterThan(0);

    expect(new URL(page.url()).search).toBe("");
    expect(pageErrors).toEqual([]);

    await page.screenshot({ path: path.join(screenshotsDir, "dg-1g-homepage.png"), fullPage: true });
  });

  test("the home strip links the four products and the four runners relatively, with the resident tier line hidden", async ({ page }) => {
    await page.goto(homeUrl(), { waitUntil: "domcontentloaded" });

    const productLinks = page.locator(".home-products a");
    expect(await productLinks.evaluateAll((links) => links.map((a) => a.getAttribute("href")))).toEqual([
      "bst.html",
      "se.html",
      "taxi.html",
      "ltd.html",
    ]);

    const runnerLinks = page.locator(".runner-row a");
    expect(await runnerLinks.evaluateAll((links) => links.map((a) => a.getAttribute("href")))).toEqual([
      "runners/diya-gl-bst.html",
      "runners/diya-gl-se.html",
      "runners/diya-gl-taxi.html",
      "runners/diya-gl-ltd.html",
    ]);

    await expect(page.locator("#tier-device")).toBeVisible();
    await expect(page.locator("#tier-sandbox")).toBeVisible();
    await expect(page.locator("#tier-resident")).toBeHidden();
    await expect(page.locator("#tier-resident-pro")).toBeHidden();
    await expect(page.locator("#tier-resident-pro")).toContainText("£199 a year");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("?example= in the URL wins over the page's default and is kept in the address bar", async ({ page }) => {
    await page.goto(homeUrl("?example=ltd-scenario-full"), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    await expect(page.locator("#app-title")).toContainText("Precision Code Ltd");
    await expect.poll(() => new URL(page.url()).search).toContain("example=ltd-scenario-full");
  });
});

test.describe("DIYA-GL homepage — the address bar", () => {
  test("gains the deep link once the reader leaves the default view and clears again on the way back", async ({ page }) => {
    await page.goto(homeUrl(), { waitUntil: "domcontentloaded" });
    await expectExampleLoaded(page);
    expect(new URL(page.url()).search).toBe("");

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => new URL(page.url()).search).toContain("view=profit-loss");
    await expect.poll(() => new URL(page.url()).search).toContain("example=ltd-brickwork-pro-vat");

    await page.locator('.tab-btn[data-view="year"]').click();
    await expect(page.locator('.tab-btn[data-view="year"]')).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });
});

test.describe("DIYA-GL homepage — a saved working book", () => {
  test("is offered as a banner over the example and left untouched by the example load", async ({ page }) => {
    await seedSavedBook(page);

    await page.goto(homeUrl(), { waitUntil: "domcontentloaded" });
    await expectExampleLoaded(page);

    const banner = page.locator(".continue-banner .continue-offer");
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText("ltd-scenario-full");
    await expect(page.locator(".empty-state")).toHaveCount(0);
    expect(await page.evaluate(() => window.DiyaGlAutosave.loadWorkingBook().then((record) => record.source.label))).toBe(
      "ltd-scenario-full",
    );

    await banner.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("#app-title")).toContainText("Precision Code Ltd", { timeout: 30_000 });
    await expect(page.locator(".continue-banner")).toHaveCount(0);
  });

  test("is discarded from the banner, which then goes while the example stays", async ({ page }) => {
    await seedSavedBook(page);

    await page.goto(homeUrl(), { waitUntil: "domcontentloaded" });
    await expectExampleLoaded(page);
    const banner = page.locator(".continue-banner .continue-offer");
    await expect(banner).toBeVisible({ timeout: 10_000 });

    await banner.getByRole("button", { name: "Discard" }).click();
    await expect(page.locator(".continue-banner")).toHaveCount(0);
    await expect(page.locator("#app-title")).toContainText("BrickWork Pro Ltd");
    expect(await page.evaluate(() => window.DiyaGlAutosave.loadWorkingBook())).toBeFalsy();
  });

  test("is still offered on the empty state of a product page, as before", async ({ page }) => {
    await seedSavedBook(page);

    await page.goto(`${baseUrl}/bst.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".empty-state .continue-offer")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".continue-banner")).toHaveCount(0);
  });
});

test.describe("DIYA-GL homepage — the resident tier line", () => {
  test("shows once the account list reports the resident tier", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await withBooksList(page, { reason: "active-subscription", expiry: null, residentTier: true });

    await page.goto(homeUrl(), { waitUntil: "domcontentloaded" });
    await expect(page.locator("#tier-resident")).toBeHidden();
    await page.click("#account-btn");
    await expect(page.locator(".account-entitlement")).toContainText("Subscribed");
    await expect(page.locator("#tier-resident")).toBeVisible();
    await expect(page.locator("#tier-resident")).toContainText("£39 a year");
  });

  test("stays hidden while the account list reports the tier as disabled", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await withBooksList(page, { reason: "tier-disabled", expiry: null, residentTier: false });

    await page.goto(homeUrl(), { waitUntil: "domcontentloaded" });
    await page.click("#account-btn");
    await expect(page.locator(".account-entitlement")).toContainText("35-day sandbox");
    await expect(page.locator("#tier-resident")).toBeHidden();
  });
});
