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
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

import { buildSheetMap, readCellValue, loadSharedStrings } from "../../app/lib/spreadsheet-runner.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const BUNDLE = path.join(PUBLIC_DIR, "books/engine/diya-gl-engine.js");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".jsonl": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const filePath = path.join(rootDir, requested);
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(fs.readFileSync(filePath));
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => resolveServer({ server, port: server.address().port }));
  });
}

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
    const { server, port } = await startStaticServer(PUBLIC_DIR);
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    let download = null;
    page.on("download", (d) => (download = d));

    try {
      await page.goto(`http://127.0.0.1:${port}/books/save-probe.html`, { waitUntil: "domcontentloaded" });
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
      server.close();
    }
  });

  test("clicking save package downloads the zip with the workbook at its root", async ({ page }) => {
    const { server, port } = await startStaticServer(PUBLIC_DIR);
    try {
      await page.goto(`http://127.0.0.1:${port}/books/save-probe.html`, { waitUntil: "domcontentloaded" });
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
      server.close();
    }
  });
});
