// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/site-rum-loader.browser.test.js
//
// analytics.js injects a <script src="/lib/rum-config.js"> on every page,
// a file SpreadsheetsStack.java's own BucketDeployment writes at deploy
// time carrying the RUM app monitor id, identity pool and guest role. This
// static checkout carries no such file, so the real request always 404s;
// page.route() stands in for the deployed file to exercise the
// consent-gated init path (initRum() in analytics.js).

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

const FAKE_RUM_CONFIG = {
  appMonitorId: "11111111-1111-1111-1111-111111111111",
  identityPoolId: "us-east-1:22222222-2222-2222-2222-222222222222",
  guestRoleArn: "arn:aws:iam::064390746177:role/ci-spreadsheets-RumGuestRole",
  region: "us-east-1",
  sessionSampleRate: 1,
};

// Stands in for the file SpreadsheetsStack.java's BucketDeployment writes.
async function routeRumConfig(page) {
  await page.route("**/lib/rum-config.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: `window.__RUM_CONFIG__ = ${JSON.stringify(FAKE_RUM_CONFIG)};`,
    }),
  );
}

// initRum() appends the real cwr client script once consent is granted;
// abort it so a passing test never depends on reaching AWS.
async function blockRumClientScript(page) {
  await page.route("https://client.rum.us-east-1.amazonaws.com/**", (route) => route.abort());
}

test.describe("analytics.js — RUM loader", () => {
  test("injects the rum-config.js script tag on every page load", async ({ page }) => {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });

    await expect.poll(() => page.evaluate(() => !!document.querySelector('script[src="/lib/rum-config.js"]'))).toBe(true);
  });

  test("does not start the RUM client without consent, even once the config loads", async ({ page }) => {
    await routeRumConfig(page);
    await blockRumClientScript(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });

    await page.waitForFunction(() => window.__RUM_CONFIG__ !== undefined);

    expect(await page.evaluate(() => !!window.AwsRumClient)).toBe(false);
  });

  test("starts the RUM client once consent is granted through the banner, without a reload", async ({ page }) => {
    await routeRumConfig(page);
    await blockRumClientScript(page);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__RUM_CONFIG__ !== undefined);

    await page.click("#consent-accept");

    await expect.poll(() => page.evaluate(() => !!window.AwsRumClient)).toBe(true);
    expect(await page.evaluate(() => window.AwsRumClient.i)).toBe(FAKE_RUM_CONFIG.appMonitorId);
  });
});
