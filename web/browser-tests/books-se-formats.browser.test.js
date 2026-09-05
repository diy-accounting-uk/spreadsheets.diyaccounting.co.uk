// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-se-formats.browser.test.js
//
// E3 to E5 for the Self Employed page (books/se.html): the round trips its
// downloads make with the CLI, the files it refuses and what it says about
// them, and that every download the save menu offers is well-formed.
//
// The page reads a Self Employed book back from a diya-gl zip or a diya-gl
// JSON file; products/se.js's upload.validate still refuses the nine
// workbooks themselves. So E3's round trip runs the other way round from
// BST's -- the page writes the package zip and the CLI reads it back -- and
// E4 asserts each refusal by the message it actually prints.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { parseDiyaGlData } from "../../app/lib/diya-gl-loader.js";
import { writeBookJson } from "../../app/lib/books-interchange.js";
import { SCENARIOS_SE } from "./r-sources.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const BUNDLE = path.join(PUBLIC_DIR, "books/engine/diya-gl-engine.js");
const TARGET_DIR = path.join(ROOT, "target", "books-se-formats");

const FEATURED = SCENARIOS_SE[0];
const BOOK_DIR = path.join(ROOT, FEATURED.bookDir);
const SE_PACKAGE_DIR = path.join(ROOT, "examples/se-latest");
const BST_WORKBOOK_PATH = path.join(ROOT, "examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx");

fs.mkdirSync(TARGET_DIR, { recursive: true });

const advancedBookToml = fs.readFileSync(path.join(BOOK_DIR, "book.toml"), "utf-8");
const advancedLinesJsonl = fs.readFileSync(path.join(BOOK_DIR, "lines.jsonl"), "utf-8");
const { book: advancedBook, lines: advancedLines } = parseDiyaGlData(advancedBookToml, advancedLinesJsonl);
const advancedJsonText = writeBookJson(advancedBook, advancedLines);

async function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

let FIXTURES;

async function buildFixtures() {
  return {
    diyaGlZip: {
      bytes: await zipOf({ "book.toml": advancedBookToml, "lines.jsonl": advancedLinesJsonl, "report.json": "{}\n" }),
      name: "precision-code-advanced-diya-gl.zip",
    },
    json: { bytes: Buffer.from(advancedJsonText, "utf-8"), name: "precision-code-advanced-diya-gl.json" },
    hubWorkbook: {
      bytes: fs.readFileSync(path.join(SE_PACKAGE_DIR, "Financialaccounts.xlsx")),
      name: "Financialaccounts.xlsx",
    },
    payslipsOnlyZip: {
      bytes: await zipOf({ "Payslips.xlsx": fs.readFileSync(path.join(SE_PACKAGE_DIR, "Payslips.xlsx")) }),
      name: "payslips-only.zip",
    },
    bstWorkbook: { bytes: fs.readFileSync(BST_WORKBOOK_PATH), name: "GB_Accounts_Basic_Sole_Trader.xlsx" },
  };
}

let closeServer;
let baseUrl;

test.beforeAll(async () => {
  if (!fs.existsSync(BUNDLE)) {
    throw new Error(`No bundle at ${BUNDLE}. Run: node scripts/build-books-bundle.mjs`);
  }
  FIXTURES = await buildFixtures();
  const server = await startStaticServer(PUBLIC_DIR);
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer();
});

function seUrl() {
  return `${baseUrl}/books/se.html`;
}

async function dropFile(page, bytes, name, mimeType) {
  const base64 = bytes.toString("base64");
  await page.evaluate(
    ({ base64, name, mimeType }) => {
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const file = new File([array], name, { type: mimeType || "application/octet-stream" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const target = document.querySelector(".empty-state") || document.body;
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { base64, name, mimeType },
  );
}

async function waitForLoaded(page) {
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function openAdvancedExample(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${seUrl()}?example=${FEATURED.example}`, { waitUntil: "domcontentloaded" });
  await waitForLoaded(page);
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function triggerSaveDownload(page, menuItemName) {
  await page.click("#save-btn");
  const item = page.getByRole("menuitem", { name: menuItemName, exact: true });
  await item.waitFor({ state: "visible" });
  const [download] = await Promise.all([page.waitForEvent("download"), item.click()]);
  return { download, bytes: await readDownload(download) };
}

// ── E3: round trips ──────────────────────────────────────────────────────

test.describe("DIYA-GL books page — Self Employed round trips (E3)", () => {
  // Package zip -> page -> package zip. The nine workbooks carry no column
  // for an entry number, a document type or a tax code, so a line that goes
  // in through the master book comes back out renumbered and without them:
  // the round trip settles from the first extraction on, not before it. So
  // the page's package zip goes to the CLI, the CLI's book comes back to the
  // page, and the second lap has to reproduce both files exactly.
  test("page to package zip to CLI and back: the second lap writes the same zip and reads the same lines", async ({ page }) => {
    await openAdvancedExample(page);

    const firstPackage = await triggerSaveDownload(page, "Download package (.zip)");
    const firstZipPath = path.join(TARGET_DIR, "e3-se-package-1.zip");
    fs.writeFileSync(firstZipPath, firstPackage.bytes);

    const firstExport = path.join(TARGET_DIR, "e3-se-export-1");
    execFileSync(process.execPath, ["app/bin/export.js", "--package", "se", "--file", firstZipPath, "--output-dir", firstExport], {
      cwd: ROOT,
      stdio: "pipe",
    });
    const firstBookToml = fs.readFileSync(path.join(firstExport, "book.toml"), "utf-8");
    const firstLinesJsonl = fs.readFileSync(path.join(firstExport, "lines.jsonl"), "utf-8");

    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(
      page,
      await zipOf({ "book.toml": firstBookToml, "lines.jsonl": firstLinesJsonl, "report.json": "{}\n" }),
      "e3-se-extracted-diya-gl.zip",
    );
    await waitForLoaded(page);

    const secondPackage = await triggerSaveDownload(page, "Download package (.zip)");
    const secondZipPath = path.join(TARGET_DIR, "e3-se-package-2.zip");
    fs.writeFileSync(secondZipPath, secondPackage.bytes);

    const secondExport = path.join(TARGET_DIR, "e3-se-export-2");
    execFileSync(process.execPath, ["app/bin/export.js", "--package", "se", "--file", secondZipPath, "--output-dir", secondExport], {
      cwd: ROOT,
      stdio: "pipe",
    });

    expect(fs.readFileSync(path.join(secondExport, "lines.jsonl"), "utf-8")).toBe(firstLinesJsonl);
    expect(Buffer.compare(secondPackage.bytes, firstPackage.bytes)).toBe(0);
  });

  test("diya-gl zip to page to diya-gl zip is identical, and so is JSON to page to JSON", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.diyaGlZip.bytes, FIXTURES.diyaGlZip.name);
    await waitForLoaded(page);

    const roundTripped = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const zip = await JSZip.loadAsync(roundTripped.bytes);
    expect(await zip.file("book.toml").async("string")).toBe(advancedBookToml);
    expect(await zip.file("lines.jsonl").async("string")).toBe(advancedLinesJsonl);

    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.json.bytes, FIXTURES.json.name);
    await waitForLoaded(page);
    const json = await triggerSaveDownload(page, "Download books as JSON (.json)");
    expect(json.bytes.toString("utf-8")).toBe(advancedJsonText);
  });
});

// ── E4: what the page refuses, and what it says ──────────────────────────

test.describe("DIYA-GL books page — Self Employed refusals (E4)", () => {
  test("a bare Financialaccounts.xlsx is refused by name, not read as anything else", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(
      page,
      FIXTURES.hubWorkbook.bytes,
      FIXTURES.hubWorkbook.name,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const message = page.locator("#empty-state-message");
    await expect(message).toHaveClass(/upload-error/);
    await expect(message).toContainText("does not match the current Basic Sole Trader template");
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);
  });

  test("a zip whose only workbook is Payslips.xlsx is refused by name", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.payslipsOnlyZip.bytes, FIXTURES.payslipsOnlyZip.name);

    // One workbook in a zip is a package zip of a single-file product, so
    // the sniff hands it to the Basic Sole Trader manifest and its anchor
    // guard is what names the mismatch.
    const message = page.locator("#empty-state-message");
    await expect(message).toHaveClass(/upload-error/);
    await expect(message).toContainText("does not match the current Basic Sole Trader template");
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);
  });

  test("a Basic Sole Trader workbook dropped here loads, on the Basic Sole Trader manifest", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(
      page,
      FIXTURES.bstWorkbook.bytes,
      FIXTURES.bstWorkbook.name,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    await waitForLoaded(page);

    expect(await page.evaluate(() => window.DiyaGlBooksPage.manifest.id)).toBe("bst");
    expect(await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.book.entityInformation["diya-gl:product"])).toBe("BasicSoleTrader");
  });
});

// ── E5: every download the save menu offers ──────────────────────────────

test.describe("DIYA-GL books page — Self Employed downloads (E5)", () => {
  test("all three downloads are well-formed, and no single workbook is offered", async ({ page }) => {
    await openAdvancedExample(page);

    await page.click("#save-btn");
    const items = await page.getByRole("menuitem").allInnerTexts();
    expect(items).toEqual(["Download package (.zip)", "Download books as diya-gl (.zip)", "Download books as JSON (.json)"]);
    await page.keyboard.press("Escape");

    const packageZip = await triggerSaveDownload(page, "Download package (.zip)");
    const zip = await JSZip.loadAsync(packageZip.bytes);
    const workbooks = Object.keys(zip.files).filter((name) => name.endsWith(".xlsx"));
    expect(workbooks.length).toBe(9);
    const dirNames = new Set(workbooks.map((name) => path.dirname(name)));
    expect(dirNames.size, "every workbook sits under one package directory").toBe(1);
    for (const name of workbooks) {
      const workbook = await JSZip.loadAsync(await zip.file(name).async("uint8array"));
      expect(await workbook.file("xl/workbook.xml").async("string"), `${name} recalculates on load`).toContain('fullCalcOnLoad="1"');
    }

    const diyaGlZip = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const diyaGl = await JSZip.loadAsync(diyaGlZip.bytes);
    expect(Object.keys(diyaGl.files).sort()).toEqual(["book.toml", "bookchecks.json", "lines.jsonl", "report.json"]);

    const json = await triggerSaveDownload(page, "Download books as JSON (.json)");
    const document = JSON.parse(json.bytes.toString("utf-8"));
    expect(document.format).toBe("diya-gl-books");
    expect(document.version).toBe(1);
    expect(document.product).toBe("se");
  });
});
