// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// books-save.browser.test.js — the save rung, in the browser.
//
// save-probe.html loads the SP Sixty Driving BST book through the bundled
// engine and wires two buttons to save.js, the same module the books page's
// save controls call. This test clicks each button and proves the download
// it triggers is well-formed: unzip or parse the bytes the page reports and
// check the book's own details came through.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { startStaticServer } from "./serve.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const BUNDLE = path.join(PUBLIC_DIR, "books/engine/diya-gl-engine.js");

test.describe("books save — the browser save path produces a well-formed download", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(BUNDLE)) {
      throw new Error(`No bundle at ${BUNDLE}. Run: npm run build:books-bundle`);
    }
  });

  test("clicking save downloads the diya-gl zip, carrying the book's own details", async ({ page }) => {
    const { baseUrl, close } = await startStaticServer(PUBLIC_DIR);
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    let download = null;
    page.on("download", (d) => (download = d));

    try {
      await page.goto(`${baseUrl}/books/save-probe.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#save-diya-gl-btn:not([disabled])", { timeout: 30_000 });

      await page.click("#save-diya-gl-btn");
      await page.waitForFunction(() => document.body.dataset.saveState === "done" || document.body.dataset.saveState === "failed", null, {
        timeout: 60_000,
      });

      const result = await page.evaluate(() => window.__DIYA_SAVE_RESULT__);
      expect(consoleErrors, "the save probe raised no uncaught error").toEqual([]);
      expect(result.error ?? null, "the save ran to completion").toBeNull();
      expect(result.ok).toBe(true);
      expect(result.format).toBe("diya-gl-zip");
      expect(result.filename).toMatch(/\.zip$/);
      expect(result.mimeType).toBe("application/zip");

      // The real download code path ran: Blob, anchor, click.
      expect(download, "the anchor's synthetic click triggered a real browser download").not.toBeNull();
      if (download) expect(download.suggestedFilename()).toBe(result.filename);

      const bytes = Buffer.from(result.base64, "base64");
      const zip = await JSZip.loadAsync(bytes);
      expect(Object.keys(zip.files).sort()).toEqual(["book.toml", "lines.jsonl", "report.json"]);

      const bookToml = parseTOML(await zip.file("book.toml").async("string"));
      expect(bookToml.entityInformation.organizationIdentifier, "the book's own organisation name is written").toBe("SP Sixty Driving");

      const linesJsonl = await zip.file("lines.jsonl").async("string");
      expect(linesJsonl.trim().split("\n").length, "the book's own lines are written").toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  test("clicking save JSON downloads the diya-gl-books document, carrying the book's own details", async ({ page }) => {
    const { baseUrl, close } = await startStaticServer(PUBLIC_DIR);
    try {
      await page.goto(`${baseUrl}/books/save-probe.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#save-json-btn:not([disabled])", { timeout: 30_000 });

      await page.click("#save-json-btn");
      await page.waitForFunction(() => document.body.dataset.saveState === "done" || document.body.dataset.saveState === "failed", null, {
        timeout: 60_000,
      });

      const result = await page.evaluate(() => window.__DIYA_SAVE_RESULT__);
      expect(result.error ?? null).toBeNull();
      expect(result.ok).toBe(true);
      expect(result.format).toBe("json");
      expect(result.filename).toMatch(/\.json$/);
      expect(result.mimeType).toBe("application/json");

      const bytes = Buffer.from(result.base64, "base64");
      const document = JSON.parse(bytes.toString("utf-8"));
      expect(document.format).toBe("diya-gl-books");
      expect(document.version).toBe(1);
      expect(document.product).toBe("bst");
      expect(document.book.entityInformation.organizationIdentifier).toBe("SP Sixty Driving");
      expect(document.lines.length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });
});
