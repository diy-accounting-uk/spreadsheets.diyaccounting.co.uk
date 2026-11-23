// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-ltd-ixbrl.browser.test.js
//
// The Company books page takes an iXBRL accounts document from the file
// dialog: the document opens as a Company book, and the places where the book
// and the file part are shown as a notice.

import { test, expect } from "@playwright/test";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/diya-gl.co.uk/public");
const fixtureDir = path.join(process.cwd(), "app/test/fixtures/ixbrl");

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

test.describe("DIYA-GL Company page — an iXBRL accounts document from the file dialog", () => {
  test("the file input and the drop hint name the accounts document types", async ({ page }) => {
    await page.goto(`${baseUrl}/ltd.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#file-picker")).toHaveAttribute("accept", /\.xhtml/);
    await expect(page.locator("#file-picker")).toHaveAttribute("accept", /\.html/);
    await expect(page.locator("#file-picker")).toHaveAttribute("accept", /\.xml/);
    await expect(page.locator(".empty-state")).toContainText(".xhtml");
  });

  test("a filed micro-entity document opens as the Company book", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/ltd.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.DiyaGlPage && window.DiyaGlPage.manifest, null, { timeout: 30_000 });

    await page.locator("#file-picker").setInputFiles(path.join(fixtureDir, "adp-micro.xhtml"));

    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 60_000 });
    await expect(page.locator("#app-title")).toContainText("Blueharp Consultants Ltd");
    expect(await page.evaluate(() => window.DIYA_GL_SNAPSHOT.source.product)).toBe("ltd");
  });

  test("a document whose figures part from the book shows each difference as a notice", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/ltd.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.DiyaGlPage && window.DiyaGlPage.manifest, null, { timeout: 30_000 });

    await page.locator("#file-picker").setInputFiles(path.join(fixtureDir, "adp-small-full.xhtml"));

    await expect(page.locator("#app-title")).toContainText("NOMAD MAISON LTD", { timeout: 60_000 });
    await expect(page.locator("#toast")).toContainText("differ in 2 places");
  });
});
