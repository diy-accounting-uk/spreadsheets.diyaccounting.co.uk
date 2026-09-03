// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-formats.browser.test.js
//
// E3-E5 in PLAN_DIYA_GL_BST_CLI_MCP_WEB.md's test approach: every way a
// file can reach the books page, sniffed by content; the diya-gl zip and
// JSON downloads the save menu now offers; and the byte-identity rungs
// (A1, A2) that tie a browser export to a CLI export of the same book.
//
// Six byte kinds reach the page: a workbook, its package zip, a diya-gl
// zip, a diya-gl JSON file, that JSON zipped, and the legacy .xls this
// pipeline cannot read. The first five are dropped onto the empty-state
// card through a synthetic DataTransfer and loaded through the picker's
// own path where a test needs a real download afterwards; every one of
// them is expected to land on the same book -- bst-latest's workbook and
// examples/precision-code-ltd/bst are the same underlying scenario, so the
// year's turnover reads £409,900.00 whichever door it came through.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { parseDiyaGlData } from "../../app/lib/diya-gl-loader.js";
import { writeBookJson } from "../../app/lib/books-interchange.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const BUNDLE = path.join(PUBLIC_DIR, "books/engine/diya-gl-engine.js");
const ASSETS_EXAMPLE_DIR = path.join(PUBLIC_DIR, "books/assets/examples/precision-code-ltd/bst");
const TARGET_DIR = path.join(ROOT, "target", "books-formats");

const WORKBOOK_PATH = path.join(ROOT, "examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx");
const PRECISION_DIR = path.join(ROOT, "examples/precision-code-ltd/bst");
const SE_WORKBOOK_PATH = path.join(ROOT, "app/templates/se/Financialaccounts.xlsx");

const YEAR_TOTAL = 409900;
const YEAR_TOTAL_TEXT = "£409,900.00";

fs.mkdirSync(TARGET_DIR, { recursive: true });

const workbookBytes = fs.readFileSync(WORKBOOK_PATH);
const precisionBookToml = fs.readFileSync(path.join(PRECISION_DIR, "book.toml"), "utf-8");
const precisionLinesJsonl = fs.readFileSync(path.join(PRECISION_DIR, "lines.jsonl"), "utf-8");
const { book: precisionBook, lines: precisionLines } = parseDiyaGlData(precisionBookToml, precisionLinesJsonl);
const precisionJsonText = writeBookJson(precisionBook, precisionLines);

async function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function buildFixtures() {
  return {
    workbook: { bytes: workbookBytes, name: "GB_Accounts_Basic_Sole_Trader.xlsx" },
    packageZip: {
      bytes: await zipOf({ "GB_Accounts_Basic_Sole_Trader.xlsx": workbookBytes }),
      name: "bst-package.zip",
    },
    diyaGlZip: {
      bytes: await zipOf({ "book.toml": precisionBookToml, "lines.jsonl": precisionLinesJsonl, "report.json": "{}\n" }),
      name: "precision-code-diya-gl.zip",
    },
    json: { bytes: Buffer.from(precisionJsonText, "utf-8"), name: "precision-code-diya-gl.json" },
    jsonZip: {
      bytes: await zipOf({ "book.json": precisionJsonText }),
      name: "precision-code-diya-gl.json.zip",
    },
    xls: {
      bytes: Buffer.concat([Buffer.from("D0CF11E0A1B11AE1", "hex"), Buffer.alloc(504)]),
      name: "legacy-accounts.xls",
    },
    seWorkbook: { bytes: fs.readFileSync(SE_WORKBOOK_PATH), name: "Financialaccounts.xlsx" },
  };
}

let FIXTURES;

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

function bstUrl() {
  return `${baseUrl}/books/bst.html`;
}

// Drops a File built from bytes onto the empty-state card through a
// synthetic DataTransfer -- the same mechanism a real drag-and-drop
// produces, minus the OS-level drag choreography Playwright cannot
// simulate. Falls back to document.body when no card exists (a book is
// already loaded), which is exactly the case the "refused" tests exercise.
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

async function readSnapshotTotal(page) {
  return page.evaluate(() => window.DIYA_BST_SNAPSHOT.annual.sales);
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Opens the save menu and clicks the named item, capturing the bytes it
// downloads -- the same #save-btn / role=menuitem path a reader clicks.
async function triggerSaveDownload(page, menuItemName) {
  await page.click("#save-btn");
  const item = page.getByRole("menuitem", { name: menuItemName, exact: true });
  await item.waitFor({ state: "visible" });
  const [download] = await Promise.all([page.waitForEvent("download"), item.click()]);
  const bytes = await readDownload(download);
  return { download, bytes };
}

test.describe("DIYA-GL books page — every way in", () => {
  test("workbook, package zip, diya-gl zip, JSON and zipped JSON all drop to the same book", async ({ page }) => {
    const kinds = [
      ["workbook", FIXTURES.workbook],
      ["package-zip", FIXTURES.packageZip],
      ["diya-gl-zip", FIXTURES.diyaGlZip],
      ["json", FIXTURES.json],
      ["json-zip", FIXTURES.jsonZip],
    ];
    for (const [kind, fixture] of kinds) {
      await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
      await dropFile(page, fixture.bytes, fixture.name);
      await waitForLoaded(page);
      expect(await readSnapshotTotal(page), `${kind} snapshot total`).toBe(YEAR_TOTAL);
      await expect(page.locator("tfoot.year-totals"), `${kind} DOM total`).toContainText(YEAR_TOTAL_TEXT);
    }
  });

  test("a .zip renamed .xlsx still loads -- content decides, not the name", async ({ page }) => {
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.packageZip.bytes, "renamed-package.xlsx");
    await waitForLoaded(page);
    expect(await readSnapshotTotal(page)).toBe(YEAR_TOTAL);
  });

  test("the legacy .xls is refused, naming the fix, not read as anything else", async ({ page }) => {
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.xls.bytes, FIXTURES.xls.name);
    await expect(page.locator("#empty-state-message")).toContainText("older .xls format");
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);
  });

  test("an SE workbook fails the anchor guard by name, not silently or as a crash", async ({ page }) => {
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(
      page,
      FIXTURES.seWorkbook.bytes,
      FIXTURES.seWorkbook.name,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const message = page.locator("#empty-state-message");
    await expect(message).toHaveClass(/upload-error/);
    await expect(message).toContainText("does not match the current Basic Sole Trader template");
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);
  });

  test("dropping onto a loaded book is refused; its own control returns to the empty state", async ({ page }) => {
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
    await waitForLoaded(page);

    await dropFile(page, FIXTURES.workbook.bytes, FIXTURES.workbook.name);
    const toast = page.locator("#toast");
    await expect(toast).toContainText("Close this book first");

    await toast.locator(".toast-action-btn").click();
    await expect(page.locator(".empty-state h2")).toHaveText("View your books in DIYA-GL");
    await expect(page.locator(".continue-offer")).toBeVisible();
  });
});

test.describe("DIYA-GL books page — every way out: the diya-gl zip and JSON downloads", () => {
  test("A1: the diya-gl zip's book.toml and lines.jsonl equal the served example, byte for byte", async ({ page }) => {
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
    await waitForLoaded(page);

    const { bytes } = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).sort()).toEqual(["book.toml", "lines.jsonl", "report.json"]);

    const bookToml = await zip.file("book.toml").async("string");
    const linesJsonl = await zip.file("lines.jsonl").async("string");
    expect(bookToml).toBe(fs.readFileSync(path.join(ASSETS_EXAMPLE_DIR, "book.toml"), "utf-8"));
    expect(linesJsonl).toBe(fs.readFileSync(path.join(ASSETS_EXAMPLE_DIR, "lines.jsonl"), "utf-8"));
  });

  test("A2: the diya-gl zip's report.json equals report.js --data's, byte for byte", async ({ page }) => {
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
    await waitForLoaded(page);

    const { bytes } = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const zip = await JSZip.loadAsync(bytes);
    const pageReportText = await zip.file("report.json").async("string");

    const outputDir = path.join(TARGET_DIR, "r-basic");
    execFileSync(
      process.execPath,
      ["app/bin/report.js", "--package", "bst", "--data", "examples/precision-code-ltd/bst", "--output-dir", outputDir],
      {
        cwd: ROOT,
        stdio: "pipe",
      },
    );
    const cliReportText = fs.readFileSync(path.join(outputDir, "report.json"), "utf-8");

    expect(pageReportText).toBe(cliReportText);
  });

  test("E5: all four downloads are well-formed", async ({ page }) => {
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
    await waitForLoaded(page);

    const xlsx = await triggerSaveDownload(page, "Download bst-excel.xlsx");
    const xlsxZip = await JSZip.loadAsync(xlsx.bytes);
    expect(await xlsxZip.file("xl/workbook.xml").async("string")).toContain('fullCalcOnLoad="1"');

    const zip = await triggerSaveDownload(page, "Download package (.zip)");
    const packageZip = await JSZip.loadAsync(zip.bytes);
    const entries = Object.keys(packageZip.files);
    expect(entries.length).toBe(1);
    const innerXlsx = await JSZip.loadAsync(await packageZip.file(entries[0]).async("uint8array"));
    expect(await innerXlsx.file("xl/workbook.xml").async("string")).toContain('fullCalcOnLoad="1"');

    const diyaGlZip = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const diyaGl = await JSZip.loadAsync(diyaGlZip.bytes);
    expect(Object.keys(diyaGl.files).sort()).toEqual(["book.toml", "lines.jsonl", "report.json"]);

    const json = await triggerSaveDownload(page, "Download books as JSON (.json)");
    const document = JSON.parse(json.bytes.toString("utf-8"));
    expect(document.format).toBe("diya-gl-books");
    expect(document.version).toBe(1);
    expect(document.product).toBe("bst");
  });

  test("E3: workbook round trip through a diya-gl zip reproduces the same D; JSON round trips identically", async ({ page }) => {
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.workbook.bytes, FIXTURES.workbook.name);
    await waitForLoaded(page);

    const firstZip = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const firstZipFiles = await JSZip.loadAsync(firstZip.bytes);
    const firstBookToml = await firstZipFiles.file("book.toml").async("string");
    const firstLinesJsonl = await firstZipFiles.file("lines.jsonl").async("string");

    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, firstZip.bytes, "roundtrip-diya-gl.zip");
    await waitForLoaded(page);

    const secondWorkbook = await triggerSaveDownload(page, "Download bst-excel.xlsx");
    const workbookOut = path.join(TARGET_DIR, "e3-second.xlsx");
    fs.writeFileSync(workbookOut, secondWorkbook.bytes);

    const exportOutDir = path.join(TARGET_DIR, "e3-export");
    execFileSync(process.execPath, ["app/bin/export.js", "--package", "bst", "--file", workbookOut, "--output-dir", exportOutDir], {
      cwd: ROOT,
      stdio: "pipe",
    });
    expect(fs.readFileSync(path.join(exportOutDir, "book.toml"), "utf-8")).toBe(firstBookToml);
    expect(fs.readFileSync(path.join(exportOutDir, "lines.jsonl"), "utf-8")).toBe(firstLinesJsonl);

    // JSON -> page -> JSON is identical.
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.json.bytes, FIXTURES.json.name);
    await waitForLoaded(page);
    const jsonOut = await triggerSaveDownload(page, "Download books as JSON (.json)");
    expect(jsonOut.bytes.toString("utf-8")).toBe(precisionJsonText);
  });
});

test.describe("DIYA-GL books page — breakability", () => {
  test("an edited amount moves the report, so A2 fails on the moved keys", async ({ page }) => {
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
    await waitForLoaded(page);

    const before = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const beforeReport = JSON.parse(await (await JSZip.loadAsync(before.bytes)).file("report.json").async("string"));

    await page.evaluate(async () => {
      const edited = window.DIYA_BST_SNAPSHOT.lines.map((line, i) => (i === 0 ? { ...line, amount: line.amount + 500 } : line));
      await window.DiyaGlBooksPage.setLines(edited, "test: bump the first line by £500");
    });
    await page.waitForFunction(() => window.DIYA_BST_SNAPSHOT.edited === true);

    const after = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const afterReport = JSON.parse(await (await JSZip.loadAsync(after.bytes)).file("report.json").async("string"));

    expect(afterReport).not.toEqual(beforeReport);
    const beforeByKey = new Map(beforeReport.values.map((v) => [v.key, v.value]));
    const afterByKey = new Map(afterReport.values.map((v) => [v.key, v.value]));
    const movedKeys = [...afterByKey.keys()].filter((key) => beforeByKey.get(key) !== afterByKey.get(key));
    expect(movedKeys.length, "the edit moved at least one key").toBeGreaterThan(0);
  });
});
