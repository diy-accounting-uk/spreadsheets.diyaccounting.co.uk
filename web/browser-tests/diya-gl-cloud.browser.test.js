// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-cloud.browser.test.js
//
// Sign-in and "save to my account" (diya-gl/cloud.js), exercised with the
// authorize, token and API calls stubbed through page.route -- no real
// Cognito pool or Submit deployment is reached. Every case sets a test
// client id before cloud.js's own script runs (an addInitScript override
// cloud-config.js folds into DIYA_GL_CLOUD_CONFIG.clientId), standing in
// for the id a build fills in once IdentityStack deploys.

import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { parseDiyaGlData } from "../../app/lib/diya-gl-loader.js";

const PUBLIC_DIR = path.join(process.cwd(), "web/diya-gl.co.uk/public");
const ROOT = process.cwd();
const PRECISION_DIR = path.join(ROOT, "examples/precision-code-ltd/bst");

const PROD_API_BASE = "https://submit.diyaccounting.co.uk/api/v1";
const PROD_HOSTED_UI = "https://prod-auth.diyaccounting.co.uk";

let closeServer;
let baseUrl;
let precisionBookToml;
let precisionLinesJsonl;

test.beforeAll(async () => {
  const server = await startStaticServer(PUBLIC_DIR, path.join(process.cwd(), "infra/main/resources/diya-gl-security-headers.json"));
  baseUrl = server.baseUrl;
  closeServer = server.close;
  precisionBookToml = fs.readFileSync(path.join(PRECISION_DIR, "book.toml"), "utf-8");
  precisionLinesJsonl = fs.readFileSync(path.join(PRECISION_DIR, "lines.jsonl"), "utf-8");
  // Proves the fixture actually parses as a book before it is shipped inside
  // a fake API response -- a broken fixture should fail here, not as a
  // mystifying page-side load error three tests later.
  parseDiyaGlData(precisionBookToml, precisionLinesJsonl);
});

test.afterAll(async () => {
  await closeServer();
});

function bstUrl() {
  return `${baseUrl}/bst.html`;
}

async function withTestClientId(page) {
  await page.addInitScript(() => {
    window.DIYA_GL_CLOUD_TEST_CLIENT_ID = "test-diya-gl-client";
  });
}

// A signed-in tab, without going through the OAuth exchange: seeds the same
// sessionStorage keys processPendingReturn() would have written. Every
// value cloud.js actually reads (idToken's own nonce claim is never
// re-checked once a session already exists) is present.
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

// Seeds autosave.js's own IndexedDB record directly, the way withSignedInSession
// seeds sessionStorage: before the page's own scripts run, so shell.js's boot
// (checkForSavedBook) picks it up as state.savedBook and cloud.js's device row
// finds it the first time the panel opens.
async function withSavedWorkingBook(page, record) {
  await page.addInitScript((seeded) => {
    var request = indexedDB.open("diya-books-autosave", 1);
    request.onupgradeneeded = function () {
      if (!request.result.objectStoreNames.contains("workingBook")) {
        request.result.createObjectStore("workingBook");
      }
    };
    request.onsuccess = function () {
      request.result.transaction("workingBook", "readwrite").objectStore("workingBook").put(seeded, "current");
    };
  }, record);
}

function fakeIdToken(claims) {
  function b64url(obj) {
    return Buffer.from(JSON.stringify(obj)).toString("base64url");
  }
  return `${b64url({ alg: "none" })}.${b64url(claims)}.sig`;
}

async function diyaGlZipBase64() {
  const zip = new JSZip();
  zip.file("book.toml", precisionBookToml);
  zip.file("lines.jsonl", precisionLinesJsonl);
  zip.file("report.json", "{}\n");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return buffer.toString("base64");
}

async function loadExample(page) {
  await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

function gaEvents(page, eventName) {
  return page.evaluate(
    (name) => (window.dataLayer || []).filter((entry) => entry[0] === "event" && entry[1] === name).map((entry) => entry[2]),
    eventName,
  );
}

function cloudStorageKeys(page) {
  return page.evaluate(() => Object.keys(window.sessionStorage).filter((key) => key.indexOf("diya-gl.cloud.") === 0));
}

async function openAccountPanel(page) {
  await page.click("#account-btn");
}

test.beforeEach(async ({ page }) => {
  // A clean tab: no leftover tokens, no leftover analytics consent gate in
  // the way of the topbar or the deep-link boot.
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.sessionStorage.clear());
});

test.describe("DIYA-GL page — signed out", () => {
  test("the signed-out page offers sign-in, and the save menu's third item opens the same panel", async ({ page }) => {
    await withTestClientId(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    const accountBtn = page.locator("#account-btn");
    await expect(accountBtn).toBeVisible();
    // The accessible name must carry the visible "Sign in" label, not just
    // the email or a paraphrase of it (WCAG 2.5.3 Label in Name).
    await expect(accountBtn).toHaveAccessibleName(/^Sign in\b/);

    await accountBtn.click();
    const panel = page.locator("#account-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator("button")).toHaveCount(1);
    await expect(panel.getByRole("button", { name: "Sign in" })).toBeVisible();
    await accountBtn.click();
    await expect(panel).toBeHidden();

    await loadExample(page);
    await page.click("#save-btn");
    const cloudItem = page.getByRole("menuitem", { name: "Save to my account", exact: true });
    await expect(cloudItem).toBeVisible();
    await cloudItem.click();
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("a disabled config hides the account button and keeps a two-item save menu, with no console error", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.addInitScript(() => {
      window.DIYA_GL_CLOUD_TEST_CLIENT_ID = null;
    });
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await expect(page.locator("#account-btn")).toBeHidden();

    await loadExample(page);
    await page.click("#save-btn");
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem")).toHaveCount(2);

    expect(pageErrors).toEqual([]);
  });
});

test.describe("DIYA-GL page — the sign-in redirect", () => {
  test("carries S256 PKCE, a redirect_uri with no query, and a state", async ({ page }) => {
    await withTestClientId(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    // Whatever this route does with the request -- fulfil, abort, redirect
    // -- Chromium treats it as a real top-level navigation and tears the
    // books page's own document down the moment it commits, wiping
    // window.dataLayer with it (even reading it in the instant after the
    // click, before awaiting anything else, lands too late). cloud_sign_in
    // "started" is exercised instead by the full round-trip test below,
    // read back after the reader lands signed in; this test is purely the
    // authorize URL's own shape. Reading sessionStorage from inside a route
    // handler intercepting that same navigation proved unreliable too (the
    // main frame's execution context is mid-transition, and page.evaluate()
    // there can hang past the test timeout) -- randomUrlSafe()'s own
    // uniqueness and length are already the unit test's job
    // (diya-gl-cloud-pkce.test.js).
    let capturedUrl = null;
    await page.route(`${PROD_HOSTED_UI}/oauth2/authorize*`, async (route) => {
      capturedUrl = new URL(route.request().url());
      await route.abort();
    });

    await openAccountPanel(page);
    await page.locator("#account-panel").getByRole("button", { name: "Sign in" }).click();
    await expect.poll(() => capturedUrl !== null, { timeout: 10_000 }).toBe(true);

    expect(capturedUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(capturedUrl.searchParams.get("redirect_uri")).toBe(bstUrl());
    expect(capturedUrl.searchParams.get("scope")).toBe("openid profile email");
    expect(capturedUrl.searchParams.get("state")).toBeTruthy();
    expect(capturedUrl.searchParams.get("code_challenge")).toBeTruthy();
  });
});

test.describe("DIYA-GL page — the sign-in return", () => {
  test("exchanges the code, cleans the URL, restores the deep link, and lands signed in", async ({ page }) => {
    await withTestClientId(page);
    await page.goto(`${bstUrl()}?example=bst-scenario-basic&view=income-tax`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('.tab-btn[data-view="income-tax"]')).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });

    await page.route(`${PROD_HOSTED_UI}/oauth2/authorize*`, async (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get("state");
      await route.fulfill({
        status: 302,
        headers: { location: `${bstUrl()}?code=test-auth-code&state=${encodeURIComponent(state)}` },
      });
    });
    await page.route(`${PROD_HOSTED_UI}/oauth2/token`, async (route) => {
      const nonce = await page.evaluate(() => window.sessionStorage.getItem("diya-gl.cloud.nonce"));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id_token: fakeIdToken({ sub: "user-1", email: "reader@example.com", nonce }),
          access_token: "access-1",
          refresh_token: "refresh-1",
          expires_in: 3600,
        }),
      });
    });
    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [] }) }),
    );

    await openAccountPanel(page);
    await page.locator("#account-panel").getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL((url) => !url.search.includes("code="), { timeout: 10_000 });
    // The example and view survive; shell.js's own URL sync is free to add
    // more of its own params (a &month=... once a month is in view) on top
    // -- this only asserts the OAuth params are gone and the deep link held.
    const returnedParams = new URL(page.url()).searchParams;
    expect(returnedParams.get("code")).toBeNull();
    expect(returnedParams.get("state")).toBeNull();
    expect(returnedParams.get("example")).toBe("bst-scenario-basic");
    expect(returnedParams.get("view")).toBe("income-tax");

    await expect(page.locator("#account-btn")).toHaveAttribute("title", "reader@example.com");
    // Signed in, the visible label switches to "Account" and the accessible
    // name must still start with it -- the email is appended, not swapped in
    // as a replacement name (WCAG 2.5.3 Label in Name).
    await expect(page.locator("#account-btn .btn-label")).toHaveText("Account");
    await expect(page.locator("#account-btn")).toHaveAccessibleName("Account, signed in as reader@example.com");
    const returned = await gaEvents(page, "cloud_sign_in");
    expect(returned).toEqual([{ step: "returned" }]);
  });

  test("a mismatched state is refused without ever calling the token endpoint", async ({ page }) => {
    await withTestClientId(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.evaluate(() => {
      window.sessionStorage.setItem("diya-gl.cloud.verifier", "test-verifier");
      window.sessionStorage.setItem("diya-gl.cloud.state", "the-real-state");
      window.sessionStorage.setItem("diya-gl.cloud.nonce", "the-real-nonce");
      window.sessionStorage.setItem("diya-gl.cloud.returnTo", window.location.href);
    });

    let tokenCalled = false;
    await page.route(`${PROD_HOSTED_UI}/oauth2/token`, async (route) => {
      tokenCalled = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto(`${bstUrl()}?code=some-code&state=a-different-state`, { waitUntil: "domcontentloaded" });

    await expect(page.locator("#account-panel")).toBeVisible();
    await expect(page.locator("#account-panel")).toContainText("Sign-in could not be verified");
    expect(tokenCalled).toBe(false);
    expect(await cloudStorageKeys(page)).toEqual([]);

    const failed = await gaEvents(page, "cloud_sign_in");
    expect(failed).toEqual([{ step: "failed" }]);
  });
});

test.describe("DIYA-GL page — signed in", () => {
  test("the list renders newest first, with version, date and period", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [
            {
              bookId: "book-older",
              title: "Older Trading Ltd",
              product: "bst",
              latestVersion: 1,
              latestETag: "etag-older",
              latestSize: 15000,
              updatedAt: "2026-01-01T09:00:00.000Z",
              periodCoveredStart: "2025-01-01",
              periodCoveredEnd: "2025-12-31",
              versions: [],
              provenance: { engineVersion: "1.2.3" },
            },
            {
              bookId: "book-newer",
              title: "Newer Trading Ltd",
              product: "bst",
              latestVersion: 3,
              latestETag: "etag-newer",
              latestSize: 16000,
              updatedAt: "2026-02-01T09:00:00.000Z",
              periodCoveredStart: null,
              periodCoveredEnd: null,
              versions: [],
              provenance: { engineVersion: "1.2.3" },
            },
          ],
        }),
      }),
    );

    await openAccountPanel(page);
    const rows = page.locator(".account-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Newer Trading Ltd");
    await expect(rows.first()).toContainText("version 3");
    await expect(rows.first()).toContainText("period not set");
    await expect(rows.last()).toContainText("Older Trading Ltd");
    await expect(rows.last()).toContainText("2025-01-01 to 2025-12-31");
  });

  test("a sandbox book's row counts down to its expiry, over and under a day", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [
            Object.assign({}, unsubscribedBook(), {
              bookId: "book-long",
              title: "Long Trading Ltd",
              retention: "sandbox",
              expiresAt: new Date(Date.now() + (3 * 24 + 5) * 60 * 60_000).toISOString(),
            }),
            Object.assign({}, unsubscribedBook(), {
              bookId: "book-short",
              title: "Short Trading Ltd",
              retention: "sandbox",
              expiresAt: new Date(Date.now() + 20 * 60 * 60_000).toISOString(),
            }),
          ],
          entitlement: { reason: "tier-disabled", expiry: null, residentTier: false },
        }),
      }),
    );

    await openAccountPanel(page);
    const rows = page.locator(".account-row");
    await expect(rows.filter({ hasText: "Long Trading Ltd" })).toContainText(/expires in \d+ days/);
    await expect(rows.filter({ hasText: "Short Trading Ltd" })).toContainText("expires today");
  });

  test("a resident book's row is kept until it is deleted, not counted down", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [Object.assign({}, unsubscribedBook(), { retention: "resident", expiresAt: null })],
          entitlement: { reason: "active-subscription", expiry: null, residentTier: true },
        }),
      }),
    );

    await openAccountPanel(page);
    await expect(page.locator(".account-row").first()).toContainText("kept until you delete it");
  });

  test("the entitlement card shows the plain sandbox label when the resident tier is disabled", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ books: [], entitlement: { reason: "tier-disabled", expiry: null, residentTier: false } }),
      }),
    );

    await openAccountPanel(page);
    await expect(page.locator(".account-entitlement")).toContainText("35-day sandbox");
    await expect(page.locator(".account-entitlement").getByRole("button")).toHaveCount(0);
  });

  test("the entitlement card offers the upgrade when the resident tier is on and there is no subscription", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ books: [], entitlement: { reason: "no-subscription", expiry: null, residentTier: true } }),
      }),
    );

    await openAccountPanel(page);
    await expect(page.locator(".account-entitlement")).toContainText("35-day sandbox. Keep your books for £39 a year.");
    await expect(page.locator(".account-entitlement").getByRole("button", { name: "Subscribe" })).toBeVisible();
    await expect(page.locator(".account-entitlement").getByRole("button", { name: "or £3.99 a month" })).toBeVisible();
  });

  test("the entitlement card shows both dates for a lapsed subscription", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [],
          entitlement: { reason: "expired", expiry: "2026-02-01T09:00:00.000Z", residentTier: true },
        }),
      }),
    );

    await openAccountPanel(page);
    await expect(page.locator(".account-entitlement")).toContainText(
      "Your subscription ended February 1, 2026. These books expire March 3, 2026.",
    );
    await expect(page.locator(".account-entitlement").getByRole("button", { name: "Subscribe" })).toBeVisible();
  });

  test("the entitlement card shows the subscribed card when the resident tier is on and active", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [subscribedBook()],
          entitlement: { reason: "active-subscription", expiry: null, residentTier: true },
        }),
      }),
    );

    await openAccountPanel(page);
    await expect(page.locator(".account-entitlement")).toContainText("Subscribed: kept until you delete it");
    await expect(page.locator(".account-entitlement").getByRole("button", { name: "Manage subscription" })).toBeVisible();
    await expect(page.locator(".account-entitlement").getByRole("button", { name: "Subscribe" })).toHaveCount(0);
  });

  test("open decodes the version and loads it the same way an uploaded file would", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    const zipBase64 = await diyaGlZipBase64();
    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [
            {
              bookId: "book-1",
              title: "Precision Code Trading",
              product: "bst",
              latestVersion: 1,
              latestETag: "etag-1",
              latestSize: zipBase64.length,
              updatedAt: "2026-01-01T09:00:00.000Z",
              periodCoveredStart: "2025-01-01",
              periodCoveredEnd: "2025-12-31",
              versions: [{ version: 1, etag: "etag-1", size: zipBase64.length, createdAt: "2026-01-01T09:00:00.000Z" }],
              provenance: { engineVersion: "1.2.3" },
            },
          ],
        }),
      }),
    );
    await page.route(`${PROD_API_BASE}/books/book-1/versions/latest`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          metadata: { bookId: "book-1", title: "Precision Code Trading", latestETag: "etag-1", latestVersion: 1 },
          version: 1,
          etag: "etag-1",
          zipBase64,
        }),
      }),
    );

    await openAccountPanel(page);
    await page.getByRole("button", { name: "Open", exact: true }).first().click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    const loaded = await gaEvents(page, "book_loaded");
    expect(loaded).toEqual([{ product: "bst", source: "zip" }]);
  });

  test("sign-out clears every cloud key and navigates to the hosted UI's logout", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [] }) }),
    );

    let logoutUrl = null;
    await page.route(`${PROD_HOSTED_UI}/logout*`, async (route) => {
      logoutUrl = new URL(route.request().url());
      await route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" });
    });

    await openAccountPanel(page);
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect.poll(() => logoutUrl !== null, { timeout: 10_000 }).toBe(true);
    expect(logoutUrl.searchParams.get("client_id")).toBe("test-diya-gl-client");
    expect(logoutUrl.searchParams.get("logout_uri")).toBe(bstUrl());
  });

  test("the service worker does not intercept the cross-origin API call", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "load" });
    await page.evaluate(() => navigator.serviceWorker.ready);

    let apiRouteHit = false;
    await page.route(`${PROD_API_BASE}/books`, (route) => {
      apiRouteHit = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [] }) });
    });

    await openAccountPanel(page);
    await expect(page.locator(".account-empty")).toBeVisible();
    expect(apiRouteHit).toBe(true);
  });

  test("a list shorter than the last one seen sends sandbox_expired_seen once, with the missing count", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    let call = 0;
    await page.route(`${PROD_API_BASE}/books`, (route) => {
      call += 1;
      const books =
        call === 1
          ? [
              unsubscribedBook(),
              Object.assign({}, unsubscribedBook(), { bookId: "book-2" }),
              Object.assign({}, unsubscribedBook(), { bookId: "book-3" }),
            ]
          : [unsubscribedBook(), Object.assign({}, unsubscribedBook(), { bookId: "book-2" })];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books }) });
    });

    await openAccountPanel(page); // fetch #1: three books
    await expect(page.locator(".account-row")).toHaveCount(3);
    await openAccountPanel(page); // closes, no fetch
    await openAccountPanel(page); // fetch #2: two books
    await expect(page.locator(".account-row")).toHaveCount(2);

    expect(await gaEvents(page, "sandbox_expired_seen")).toEqual([{ missing: 1 }]);
  });

  test("a delete followed by a shorter list sends no sandbox_expired_seen", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    let call = 0;
    await page.route(`${PROD_API_BASE}/books`, (route) => {
      call += 1;
      const books = call === 1 ? [unsubscribedBook(), Object.assign({}, unsubscribedBook(), { bookId: "book-2" })] : [unsubscribedBook()];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books }) });
    });
    await page.route(`${PROD_API_BASE}/books/book-2`, (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });

    await openAccountPanel(page);
    await expect(page.locator(".account-row")).toHaveCount(2);

    await page.locator('.account-row[data-book-id="book-2"] [data-action="delete"]').click();
    await page.locator('[data-action="confirm-delete"]').click();
    await expect(page.locator(".account-row")).toHaveCount(1);

    expect(await gaEvents(page, "sandbox_expired_seen")).toEqual([]);
  });
});

test.describe("DIYA-GL page — on this device", () => {
  test("no device row renders while nothing is saved", async ({ page }) => {
    await withTestClientId(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await openAccountPanel(page);
    await expect(page.locator("#account-panel")).toBeVisible();
    await expect(page.locator(".account-device-row")).toHaveCount(0);
  });

  test("the device row names the saved book and when it was saved, signed out", async ({ page }) => {
    await withTestClientId(page);
    const savedAt = "2026-01-01T09:00:00.000Z";
    await withSavedWorkingBook(page, { book: {}, lines: [], source: { kind: "example", label: "Precision Code Trading Ltd" }, savedAt });
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    // Read back through the page's own formatSavedAt rather than a hardcoded
    // string, so the assertion holds regardless of the runner's timezone.
    const expectedWhen = await page.evaluate((iso) => window.DiyaGlPage.formatSavedAt(iso), savedAt);

    await openAccountPanel(page);
    const deviceRow = page.locator(".account-device-row");
    await expect(deviceRow).toContainText("Precision Code Trading Ltd");
    await expect(deviceRow).toContainText("saved " + expectedWhen);
    await expect(deviceRow).toContainText("kept on this device until you clear your browser data; download the file to keep it for good");
  });

  test("the device row sits above the account's own book list, signed in", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await withSavedWorkingBook(page, {
      book: {},
      lines: [],
      source: { kind: "example", label: "Precision Code Trading Ltd" },
      savedAt: "2026-01-01T09:00:00.000Z",
    });
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.route(`${PROD_API_BASE}/books`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [unsubscribedBook()] }) }),
    );

    await openAccountPanel(page);
    await expect(page.locator(".account-device-row")).toContainText("Precision Code Trading Ltd");
    await expect(page.locator(".account-row")).toHaveCount(1);
    const deviceRowBox = await page.locator(".account-device-row").boundingBox();
    const firstBookRowBox = await page.locator(".account-row").first().boundingBox();
    expect(deviceRowBox.y).toBeLessThan(firstBookRowBox.y);
  });

  test("Clear removes the device row and the page's own continue offer", async ({ page }) => {
    await withTestClientId(page);
    await withSavedWorkingBook(page, {
      book: {},
      lines: [],
      source: { kind: "example", label: "Precision Code Trading Ltd" },
      savedAt: "2026-01-01T09:00:00.000Z",
    });
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".continue-offer")).toBeVisible();
    await openAccountPanel(page);
    const deviceRow = page.locator(".account-device-row");
    await expect(deviceRow).toBeVisible();

    await deviceRow.getByRole("button", { name: "Clear" }).click();
    await expect(page.locator(".account-device-row")).toHaveCount(0);
    await expect(page.locator(".continue-offer")).toHaveCount(0);
  });

  test("navigator.storage.persist is requested once, after the first autosave that resolves true", async ({ page }) => {
    await withTestClientId(page);
    await page.addInitScript(() => {
      window.__storagePersistCalls = 0;
      navigator.storage.persist = function () {
        window.__storagePersistCalls += 1;
        return Promise.resolve(true);
      };
    });
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await loadExample(page);
    await expect.poll(() => page.evaluate(() => window.__storagePersistCalls)).toBe(1);

    await page.locator('.tab-btn[data-view="business-details"]').click();
    const name = page.locator('[data-book-field="organizationIdentifier"]');
    await name.fill("Persisted Trading Ltd");
    await name.press("Enter");
    await expect(page.locator("#app-title")).toContainText("Persisted Trading Ltd");

    expect(await page.evaluate(() => window.__storagePersistCalls)).toBe(1);
  });
});

test.describe("DIYA-GL page — save to my account", () => {
  test("the first save creates with no If-Match; the second updates with the first response's latestETag", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await loadExample(page);

    const putRequests = [];
    let version = 0;
    await page.route(`${PROD_API_BASE}/books`, (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [] }) });
      }
      return route.continue();
    });
    await page.route(`${PROD_API_BASE}/books/*`, async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      version += 1;
      putRequests.push({ ifMatch: route.request().headers()["if-match"] || null, bookId: route.request().url().split("/").pop() });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ metadata: { latestETag: "etag-" + version, latestVersion: version } }),
      });
    });

    async function saveToCloud() {
      await page.click("#save-btn");
      const item = page.getByRole("menuitem", { name: "Save to my account", exact: true });
      await item.waitFor({ state: "visible" });
      await item.click();
    }

    await saveToCloud();
    await expect(page.locator("#toast")).toContainText("Saved to your account as version 1.", { timeout: 10_000 });
    await saveToCloud();
    await expect(page.locator("#toast")).toContainText("Saved to your account as version 2.", { timeout: 10_000 });

    expect(putRequests).toHaveLength(2);
    expect(putRequests[0].ifMatch).toBeNull();
    expect(putRequests[0].bookId).toBe(putRequests[1].bookId);
    expect(putRequests[1].ifMatch).toBe('"etag-1"');

    const saveEvents = await gaEvents(page, "cloud_save");
    expect(saveEvents).toEqual([
      { product: "bst", outcome: "created" },
      { product: "bst", outcome: "updated" },
    ]);
  });

  test("a 412 shows the conflict card; saving as a new book carries a fresh id and no If-Match", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await loadExample(page);
    await page.evaluate(() => {
      window.sessionStorage.setItem("diya-gl.cloud.link", JSON.stringify({ bookId: "book-1", latestETag: "stale-etag", latestVersion: 1 }));
    });

    const putBookIds = [];
    await page.route(`${PROD_API_BASE}/books`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [
            {
              bookId: "book-1",
              title: "Precision Code Trading",
              product: "bst",
              latestVersion: 2,
              latestETag: "fresh-etag",
              latestSize: 15000,
              updatedAt: "2026-03-01T09:00:00.000Z",
              periodCoveredStart: "2025-01-01",
              periodCoveredEnd: "2025-12-31",
              versions: [],
              provenance: {},
            },
          ],
        }),
      });
    });
    await page.route(`${PROD_API_BASE}/books/*`, async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      const bookId = route.request().url().split("/").pop();
      putBookIds.push({ bookId: bookId, ifMatch: route.request().headers()["if-match"] || null });
      if (bookId === "book-1") {
        return route.fulfill({
          status: 412,
          contentType: "application/json",
          body: JSON.stringify({ message: "the account's copy moved on", code: "etag-mismatch" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ metadata: { latestETag: "new-etag", latestVersion: 1 } }),
      });
    });

    await page.click("#save-btn");
    await page.getByRole("menuitem", { name: "Save to my account", exact: true }).click();

    const conflict = page.locator(".account-conflict");
    await expect(conflict).toBeVisible({ timeout: 10_000 });
    await expect(conflict).toContainText("This book changed somewhere else.");
    await expect(conflict).toContainText("version 2, saved");
    await expect(conflict.getByRole("button")).toHaveCount(3);

    await conflict.getByRole("button", { name: "Save as a new book" }).click();
    await expect(page.locator("#toast")).toContainText("Saved to your account as version 1.", { timeout: 10_000 });

    expect(putBookIds).toHaveLength(2);
    expect(putBookIds[0].bookId).toBe("book-1");
    expect(putBookIds[1].bookId).not.toBe("book-1");
    expect(putBookIds[1].ifMatch).toBeNull();

    const conflictEvents = await gaEvents(page, "cloud_conflict");
    expect(conflictEvents).toEqual([{ resolution: "shown" }, { resolution: "new-book" }]);

    // The local book is exactly as it was: still loaded, still the same figures.
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached();
  });

  test("a 401 triggers one refresh and one retry, then signs out on the second 401", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    let tokenCalls = 0;
    await page.route(`${PROD_HOSTED_UI}/oauth2/token`, async (route) => {
      tokenCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id_token: fakeIdToken({ sub: "user-1", email: "reader@example.com" }),
          access_token: "access-2",
          expires_in: 3600,
        }),
      });
    });
    let booksCalls = 0;
    await page.route(`${PROD_API_BASE}/books`, (route) => {
      booksCalls += 1;
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "expired" }) });
    });

    await openAccountPanel(page);
    await expect(page.locator("#account-panel")).toContainText("Your session ended", { timeout: 10_000 });

    expect(tokenCalls).toBe(1);
    expect(booksCalls).toBe(2);
    expect(await cloudStorageKeys(page)).toEqual([]);
  });
});

function unsubscribedBook() {
  return {
    bookId: "book-1",
    title: "Precision Code Trading",
    product: "bst",
    latestVersion: 1,
    latestETag: "etag-1",
    latestSize: 15000,
    updatedAt: "2026-01-01T09:00:00.000Z",
    periodCoveredStart: "2025-01-01",
    periodCoveredEnd: "2025-12-31",
    versions: [],
    provenance: {},
    retention: "sandbox",
    expiresAt: "2026-02-05T09:00:00.000Z",
  };
}

function subscribedBook() {
  return Object.assign({}, unsubscribedBook(), { retention: "resident", expiresAt: null });
}

test.describe("DIYA-GL page — billing", () => {
  // The service worker now scopes the whole site, so a navigation to the stubbed checkout
  // and portal URLs would be fetched by the worker, which page.route cannot see.
  test.use({ serviceWorkers: "block" });

  test("subscribe posts the exact body and follows the returned checkout URL", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [unsubscribedBook()],
          entitlement: { reason: "no-subscription", expiry: null, residentTier: true },
        }),
      });
    });

    let checkoutRequest = null;
    await page.route(`${PROD_API_BASE}/billing/checkout`, async (route) => {
      checkoutRequest = { body: route.request().postDataJSON(), headers: route.request().headers() };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ checkoutUrl: `${baseUrl}/fake-stripe-checkout` }),
      });
    });
    let checkoutPageUrl = null;
    await page.route(`${baseUrl}/fake-stripe-checkout`, async (route) => {
      checkoutPageUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" });
    });

    await openAccountPanel(page);
    // Read the token before the click: the stubbed checkout URL navigates the page away.
    const idToken = await page.evaluate(() => window.sessionStorage.getItem("diya-gl.cloud.idToken"));
    await page.locator(".account-entitlement").getByRole("button", { name: "Subscribe" }).click();

    await expect.poll(() => checkoutRequest !== null, { timeout: 10_000 }).toBe(true);
    expect(checkoutRequest.body).toEqual({ bundleId: "resident-diya-gl", interval: "annual", returnTo: bstUrl() });
    expect(checkoutRequest.headers["authorization"]).toBe(`Bearer ${idToken}`);
    expect(checkoutRequest.headers["content-type"]).toBe("application/json");

    // location.assign's navigation tears the document down the moment it
    // commits, wiping window.dataLayer with it before a poll could ever read
    // cloud_billing back -- the PKCE authorize test hits the same Chromium
    // behaviour. The event fires (buildCloudBillingEvent's own unit case
    // covers its shape); only the request and the navigation are asserted
    // here.
    await expect.poll(() => checkoutPageUrl !== null, { timeout: 10_000 }).toBe(true);
    expect(checkoutPageUrl).toBe(`${baseUrl}/fake-stripe-checkout`);
  });

  test("the monthly link starts checkout at the monthly interval", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [unsubscribedBook()],
          entitlement: { reason: "no-subscription", expiry: null, residentTier: true },
        }),
      });
    });

    let checkoutRequest = null;
    await page.route(`${PROD_API_BASE}/billing/checkout`, async (route) => {
      checkoutRequest = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ checkoutUrl: `${baseUrl}/fake-stripe-checkout` }),
      });
    });

    await openAccountPanel(page);
    await page.locator(".account-entitlement").getByRole("button", { name: "or £3.99 a month" }).click();

    await expect.poll(() => checkoutRequest !== null, { timeout: 10_000 }).toBe(true);
    expect(checkoutRequest).toEqual({ bundleId: "resident-diya-gl", interval: "monthly", returnTo: bstUrl() });
  });

  test("returning with checkout=success cleans the URL, toasts, and re-lists the account", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);

    let booksCalls = 0;
    await page.route(`${PROD_API_BASE}/books`, (route) => {
      booksCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [subscribedBook()],
          entitlement: { reason: "active-subscription", expiry: null, residentTier: true },
        }),
      });
    });

    await page.goto(`${bstUrl()}?checkout=success&session_id=test-session`, { waitUntil: "domcontentloaded" });

    await expect.poll(() => new URL(page.url()).search).toBe("");
    await expect(page.locator("#toast")).toContainText("Thanks, your subscription is active.", { timeout: 10_000 });
    await expect.poll(() => booksCalls, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.locator(".account-entitlement")).toContainText("Subscribed");
  });

  test("returning with checkout=canceled cleans the URL, toasts, and does not re-list", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);

    let booksCalls = 0;
    await page.route(`${PROD_API_BASE}/books`, (route) => {
      booksCalls += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [] }) });
    });

    await page.goto(`${bstUrl()}?checkout=canceled`, { waitUntil: "domcontentloaded" });

    await expect.poll(() => new URL(page.url()).search).toBe("");
    await expect(page.locator("#toast")).toContainText("Checkout cancelled. Your book is safe on this page.", { timeout: 10_000 });
    expect(booksCalls).toBe(0);
  });

  test("manage subscription calls the portal route with returnTo and follows the returned URL", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${PROD_API_BASE}/books`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          books: [subscribedBook()],
          entitlement: { reason: "active-subscription", expiry: null, residentTier: true },
        }),
      });
    });

    let portalRequestUrl = null;
    await page.route(`${PROD_API_BASE}/billing/portal*`, async (route) => {
      portalRequestUrl = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ portalUrl: `${baseUrl}/fake-stripe-portal` }),
      });
    });
    let portalPageUrl = null;
    await page.route(`${baseUrl}/fake-stripe-portal`, async (route) => {
      portalPageUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" });
    });

    await openAccountPanel(page);
    await expect(page.locator(".account-entitlement")).toContainText("Subscribed");
    await page.locator(".account-entitlement").getByRole("button", { name: "Manage subscription" }).click();

    await expect.poll(() => portalRequestUrl !== null, { timeout: 10_000 }).toBe(true);
    expect(portalRequestUrl.searchParams.get("returnTo")).toBe(bstUrl());

    await expect.poll(() => portalPageUrl !== null, { timeout: 10_000 }).toBe(true);
    expect(portalPageUrl).toBe(`${baseUrl}/fake-stripe-portal`);
  });
});
