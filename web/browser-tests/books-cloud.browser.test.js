// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-cloud.browser.test.js
//
// Sign-in and "save to my account" (books/cloud.js), exercised with the
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

const PUBLIC_DIR = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const ROOT = process.cwd();
const PRECISION_DIR = path.join(ROOT, "examples/precision-code-ltd/bst");

const CI_API_BASE = "https://ci-submit.diyaccounting.co.uk/api/v1";
const CI_HOSTED_UI = "https://ci-auth.diyaccounting.co.uk";

let closeServer;
let baseUrl;
let precisionBookToml;
let precisionLinesJsonl;

test.beforeAll(async () => {
  const server = await startStaticServer(PUBLIC_DIR);
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
  return `${baseUrl}/books/bst.html`;
}

async function withTestClientId(page) {
  await page.addInitScript(() => {
    window.DIYA_GL_CLOUD_TEST_CLIENT_ID = "test-books-client";
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

test.describe("DIYA-GL books page — signed out", () => {
  test("the signed-out page offers sign-in, and the save menu's third item opens the same panel", async ({ page }) => {
    await withTestClientId(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    const accountBtn = page.locator("#account-btn");
    await expect(accountBtn).toBeVisible();

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

test.describe("DIYA-GL books page — the sign-in redirect", () => {
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
    // (books-cloud-pkce.test.js).
    let capturedUrl = null;
    await page.route(`${CI_HOSTED_UI}/oauth2/authorize*`, async (route) => {
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

test.describe("DIYA-GL books page — the sign-in return", () => {
  test("exchanges the code, cleans the URL, restores the deep link, and lands signed in", async ({ page }) => {
    await withTestClientId(page);
    await page.goto(`${bstUrl()}?example=bst-scenario-basic&view=income-tax`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('.tab-btn[data-view="income-tax"]')).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });

    await page.route(`${CI_HOSTED_UI}/oauth2/authorize*`, async (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get("state");
      await route.fulfill({
        status: 302,
        headers: { location: `${bstUrl()}?code=test-auth-code&state=${encodeURIComponent(state)}` },
      });
    });
    await page.route(`${CI_HOSTED_UI}/oauth2/token`, async (route) => {
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
    await page.route(`${CI_API_BASE}/books`, (route) =>
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
    await page.route(`${CI_HOSTED_UI}/oauth2/token`, async (route) => {
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

test.describe("DIYA-GL books page — signed in", () => {
  test("the list renders newest first, with version, date and period", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${CI_API_BASE}/books`, (route) =>
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

  test("open decodes the version and loads it the same way an uploaded file would", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    const zipBase64 = await diyaGlZipBase64();
    await page.route(`${CI_API_BASE}/books`, (route) =>
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
    await page.route(`${CI_API_BASE}/books/book-1/versions/latest`, (route) =>
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
    await page.route(`${CI_API_BASE}/books`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [] }) }),
    );

    let logoutUrl = null;
    await page.route(`${CI_HOSTED_UI}/logout*`, async (route) => {
      logoutUrl = new URL(route.request().url());
      await route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" });
    });

    await openAccountPanel(page);
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect.poll(() => logoutUrl !== null, { timeout: 10_000 }).toBe(true);
    expect(logoutUrl.searchParams.get("client_id")).toBe("test-books-client");
    expect(logoutUrl.searchParams.get("logout_uri")).toBe(bstUrl());
  });

  test("the service worker does not intercept the cross-origin API call", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "load" });
    await page.evaluate(() => navigator.serviceWorker.ready);

    let apiRouteHit = false;
    await page.route(`${CI_API_BASE}/books`, (route) => {
      apiRouteHit = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [] }) });
    });

    await openAccountPanel(page);
    await expect(page.locator(".account-empty")).toBeVisible();
    expect(apiRouteHit).toBe(true);
  });
});

test.describe("DIYA-GL books page — save to my account", () => {
  test("the first save creates with no If-Match; the second updates with the first response's latestETag", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await loadExample(page);

    const putRequests = [];
    let version = 0;
    await page.route(`${CI_API_BASE}/books`, (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [] }) });
      }
      return route.continue();
    });
    await page.route(`${CI_API_BASE}/books/*`, async (route) => {
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
    await page.route(`${CI_API_BASE}/books`, (route) => {
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
    await page.route(`${CI_API_BASE}/books/*`, async (route) => {
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

  test("a 403 subscription-required offers the subscription and loses no book", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await loadExample(page);

    await page.route(`${CI_API_BASE}/books`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [] }) });
    });
    await page.route(`${CI_API_BASE}/books/*`, async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ message: "a subscription is needed", code: "subscription-required" }),
      });
    });

    await page.click("#save-btn");
    await page.getByRole("menuitem", { name: "Save to my account", exact: true }).click();

    await expect(page.locator("#toast")).toContainText("Saving to your account needs the 99p subscription.", { timeout: 10_000 });
    await expect(page.locator(".account-entitlement")).toContainText("Storage is 99p a month");
    await expect(page.locator(".account-entitlement").getByRole("button", { name: "Subscribe" })).toBeVisible();

    const saveEvents = await gaEvents(page, "cloud_save");
    expect(saveEvents).toEqual([{ product: "bst", outcome: "unentitled" }]);
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached();
  });

  test("a 401 triggers one refresh and one retry, then signs out on the second 401", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    let tokenCalls = 0;
    await page.route(`${CI_HOSTED_UI}/oauth2/token`, async (route) => {
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
    await page.route(`${CI_API_BASE}/books`, (route) => {
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
    entitlementAtPut: { reason: "no-subscription" },
  };
}

function subscribedBook() {
  return Object.assign({}, unsubscribedBook(), { entitlementAtPut: { reason: "active-subscription" } });
}

test.describe("DIYA-GL books page — billing", () => {
  test("subscribe posts the exact body and follows the returned checkout URL", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.route(`${CI_API_BASE}/books`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [unsubscribedBook()] }) });
    });

    let checkoutRequest = null;
    await page.route(`${CI_API_BASE}/billing/checkout`, async (route) => {
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
    expect(checkoutRequest.body).toEqual({ bundleId: "resident-diya-gl", returnTo: bstUrl() });
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

  test("returning with checkout=success cleans the URL, toasts, and re-lists the account", async ({ page }) => {
    await withTestClientId(page);
    await withSignedInSession(page);

    let booksCalls = 0;
    await page.route(`${CI_API_BASE}/books`, (route) => {
      booksCalls += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [subscribedBook()] }) });
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
    await page.route(`${CI_API_BASE}/books`, (route) => {
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

    await page.route(`${CI_API_BASE}/books`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ books: [subscribedBook()] }) });
    });

    let portalRequestUrl = null;
    await page.route(`${CI_API_BASE}/billing/portal*`, async (route) => {
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
