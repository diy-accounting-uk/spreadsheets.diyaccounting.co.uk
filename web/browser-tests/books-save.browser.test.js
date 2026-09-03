// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// books-save.browser.test.js — the save rung, in the browser.
//
// save-probe.html loads the SP Sixty Driving BST book through the bundled
// engine and wires two buttons to save.js, the same module the books page's
// save controls call. This test clicks each button and proves the download
// it triggers is a well-formed workbook: unzip the bytes the page reports,
// check fullCalcOnLoad survived, check one written cell against the
// fixture's own value.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";

import { buildSheetMap, readCellValue, loadSharedStrings } from "../../app/lib/spreadsheet-runner.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const BUNDLE = path.join(PUBLIC_DIR, "books/engine/diya-gl-engine.js");

async function readCell(workbookBytes, sheetName, cellRef) {
  const zip = await JSZip.loadAsync(workbookBytes);
  const sheetPath = (await buildSheetMap(zip)).get(sheetName);
  const sharedStrings = await loadSharedStrings(zip);
  return readCellValue(await zip.file(sheetPath).async("string"), cellRef, sharedStrings);
}

test.describe("books save — the browser save path produces a well-formed workbook", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(BUNDLE)) {
      throw new Error(`No bundle at ${BUNDLE}. Run: npm run build:books-bundle`);
    }
  });

  test("clicking save downloads bst-excel.xlsx, fullCalcOnLoad set, the book's own details written", async ({ page }) => {
    const { baseUrl, close } = await startStaticServer(PUBLIC_DIR);
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    let download = null;
    page.on("download", (d) => (download = d));

    try {
      await page.goto(`${baseUrl}/books/save-probe.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#save-xlsx-btn:not([disabled])", { timeout: 30_000 });

      await page.click("#save-xlsx-btn");
      await page.waitForFunction(() => document.body.dataset.saveState === "done" || document.body.dataset.saveState === "failed", null, {
        timeout: 60_000,
      });

      const result = await page.evaluate(() => window.__DIYA_SAVE_RESULT__);
      expect(consoleErrors, "the save probe raised no uncaught error").toEqual([]);
      expect(result.error ?? null, "the save ran to completion").toBeNull();
      expect(result.ok).toBe(true);
      expect(result.format).toBe("xlsx");
      expect(result.filename).toMatch(/\.xlsx$/);
      expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      // The real download code path ran: Blob, anchor, click.
      expect(download, "the anchor's synthetic click triggered a real browser download").not.toBeNull();
      if (download) expect(download.suggestedFilename()).toBe(result.filename);

      const bytes = Buffer.from(result.base64, "base64");
      expect(bytes.length, "the downloaded bytes form a non-trivial workbook").toBeGreaterThan(10_000);
      expect(bytes.slice(0, 2).toString(), "the bytes open as a zip (xlsx container)").toBe("PK");

      const zip = await JSZip.loadAsync(bytes);
      const workbookXml = await zip.file("xl/workbook.xml").async("string");
      expect(workbookXml, "the spreadsheet app is asked to recalculate on open").toContain('fullCalcOnLoad="1"');

      expect(await readCell(bytes, "Business Details", "C5"), "the book's own organisation name is written, not the template's").toBe(
        "SP Sixty Driving",
      );
    } finally {
      await close();
    }
  });

  test("clicking save package downloads the zip with the workbook at its root", async ({ page }) => {
    const { baseUrl, close } = await startStaticServer(PUBLIC_DIR);
    try {
      await page.goto(`${baseUrl}/books/save-probe.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#save-zip-btn:not([disabled])", { timeout: 30_000 });

      await page.click("#save-zip-btn");
      await page.waitForFunction(() => document.body.dataset.saveState === "done" || document.body.dataset.saveState === "failed", null, {
        timeout: 60_000,
      });

      const result = await page.evaluate(() => window.__DIYA_SAVE_RESULT__);
      expect(result.error ?? null).toBeNull();
      expect(result.ok).toBe(true);
      expect(result.format).toBe("zip");
      expect(result.filename).toMatch(/\.zip$/);
      expect(result.mimeType).toBe("application/zip");

      const bytes = Buffer.from(result.base64, "base64");
      const outerZip = await JSZip.loadAsync(bytes);
      const entries = Object.keys(outerZip.files);
      expect(entries.length, "the zip carries exactly the one workbook").toBe(1);
      expect(entries[0]).toMatch(/\.xlsx$/);

      const workbookBytes = await outerZip.file(entries[0]).async("uint8array");
      const innerZip = await JSZip.loadAsync(workbookBytes);
      const workbookXml = await innerZip.file("xl/workbook.xml").async("string");
      expect(workbookXml).toContain('fullCalcOnLoad="1"');
    } finally {
      await close();
    }
  });
});
