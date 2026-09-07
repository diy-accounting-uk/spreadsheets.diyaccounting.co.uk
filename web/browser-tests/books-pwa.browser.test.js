// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-pwa.browser.test.js
//
// The books pages install as a PWA (books/manifest.webmanifest,
// books/sw.js) and keep working with the network cut off. Proves both: the
// manifest is a real, linked, valid manifest, and a books page -- reloaded
// after going offline -- still renders one of its example books, which
// only works if the shell, the engine, the schemas and that example's own
// data all came from the service worker's cache.

import { test, expect } from "@playwright/test";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");

const PAGES = ["bst.html", "se.html", "taxi.html", "ltd.html"];

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

test.describe("books PWA manifest", () => {
  for (const page of PAGES) {
    test(`${page} links a manifest that resolves and parses`, async ({ page: browserPage }) => {
      await browserPage.goto(`${baseUrl}/books/${page}`, { waitUntil: "domcontentloaded" });
      const href = await browserPage.locator('link[rel="manifest"]').getAttribute("href");
      expect(href).toBe("manifest.webmanifest");

      const response = await browserPage.request.get(`${baseUrl}/books/manifest.webmanifest`);
      expect(response.status()).toBe(200);
      const manifest = await response.json();
      expect(manifest.name).toBeTruthy();
      expect(manifest.start_url).toBe("/books/");
      expect(manifest.scope).toBe("/books/");
      expect(manifest.display).toBe("standalone");
      expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeGreaterThan(0);
    });
  }
});

test.describe("books PWA offline", () => {
  test("the BST page reloads offline and an example book still renders", async ({ page, context }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(`${baseUrl}/books/bst.html`, { waitUntil: "load" });

    // Resolves only once the worker has installed (its precache populated)
    // and activated -- the same signal a real install-then-use visitor gets.
    await page.evaluate(() => navigator.serviceWorker.ready);

    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames.some((name) => name.startsWith("diya-gl-books-"))).toBe(true);

    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: "domcontentloaded" });

      // The shell itself, served from cache with no network at all.
      await expect(page.locator("#app")).toBeAttached();
      await expect(page.getByRole("button", { name: /bst-scenario-basic/ })).toBeAttached();

      // Loading an example needs the engine bundle, both schemas and the
      // tax year data on top of the shell -- all cache-served offline.
      await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
      await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    } finally {
      await context.setOffline(false);
    }

    expect(pageErrors, "no uncaught error while offline").toEqual([]);
  });
});
