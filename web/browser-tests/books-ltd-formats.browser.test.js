// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-ltd-formats.browser.test.js
//
// E3 to E5 for the Company page (books/ltd.html): the round trips its
// downloads make with the CLI, over both a March year end and the
// committed October package, the files it refuses and what it says about
// them, and that every download the save menu offers is well-formed.
//
// A Company package is thirteen workbooks joined by external links, read
// back through the same extractBook() the CLI's --file mode runs (see
// products/ltd.js's bookFromWorkbook), so a package upload carries the full
// account chart, fixed assets and tax snapshot the CLI itself would read --
// there is no "upload-only gap" here to strip before a byte comparison, the
// way there is for a bare BST/SE workbook drop.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { startStaticServer } from "./serve.js";
import { parseDiyaGlData, loadDiyaGlData, diyaGlToScenario } from "../../app/lib/diya-gl-loader.js";
import { writeBookJson } from "../../app/lib/books-interchange.js";
import { saveWorkbookFiles } from "../../app/lib/product-workbook.js";
import { calculateLtdCells } from "../../app/lib/calculators/ltd.js";
import { LINK_ORDER, packageLinkCaches } from "../../app/lib/link-caches.js";
import { canonicalValue } from "../../app/lib/report-serializer.js";
import { taxYearFileName } from "../../app/lib/tax-year.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const BUNDLE = path.join(PUBLIC_DIR, "books/engine/diya-gl-engine.js");
const TARGET_DIR = path.join(ROOT, "target", "books-ltd-formats");

const HUB = "Financialaccounts.xlsx";
const FULL_BOOK_DIR = path.join(ROOT, "examples/precision-code-ltd/full");
const LATEST_PACKAGE_DIR = path.join(ROOT, "examples/ltd-latest");
const BST_WORKBOOK_PATH = path.join(ROOT, "examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx");
const LINK_CELLS_FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, "app/test/fixtures/ltd-link-cells.json"), "utf-8"));

fs.mkdirSync(TARGET_DIR, { recursive: true });

const fullBookToml = fs.readFileSync(path.join(FULL_BOOK_DIR, "book.toml"), "utf-8");
const fullLinesJsonl = fs.readFileSync(path.join(FULL_BOOK_DIR, "lines.jsonl"), "utf-8");
const { book: fullBook, lines: fullLines } = parseDiyaGlData(fullBookToml, fullLinesJsonl);
const fullJsonText = writeBookJson(fullBook, fullLines);

// MnthP&L!B9, the year's product-A-to-C sales total: 341283.333333333, which
// fmtMoney's canonical rounding prints as £341,283.33 (calculator-ltd.test.js
// asserts the same figure on CT600!AK66 and PubPl!F9).
const YEAR_TOTAL = 341283.333333333;
const YEAR_TOTAL_TEXT = "£341,283.33";

async function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

// The thirteen workbooks and the docx a fresh save of the March book writes,
// zipped flat -- workbook-set.js reads a package by each entry's base name,
// so a package zipped flat and one zipped under its own directory carry the
// same workbooks under the same names.
async function marchPackageZipBytes() {
  const { files } = await saveWorkbookFiles(fullBook, fullLines);
  return zipOf(Object.fromEntries(files.map((file) => [file.name, file.bytes])));
}

// The committed October package's own thirteen workbooks, zipped the way a
// customer's own download ships.
function latestPackageWorkbookNames() {
  return fs.readdirSync(LATEST_PACKAGE_DIR).filter((file) => file.endsWith(".xlsx"));
}

async function latestPackageZipBytes() {
  const entries = {};
  for (const name of latestPackageWorkbookNames()) entries[name] = fs.readFileSync(path.join(LATEST_PACKAGE_DIR, name));
  return zipOf(entries);
}

let FIXTURES;

async function buildFixtures() {
  return {
    packageZip: { bytes: await marchPackageZipBytes(), name: "precision-code-ltd-full-package.zip" },
    diyaGlZip: {
      bytes: await zipOf({ "book.toml": fullBookToml, "lines.jsonl": fullLinesJsonl, "report.json": "{}\n" }),
      name: "precision-code-ltd-full-diya-gl.zip",
    },
    json: { bytes: Buffer.from(fullJsonText, "utf-8"), name: "precision-code-ltd-full-diya-gl.json" },
    jsonZip: {
      bytes: await zipOf({ "book.json": fullJsonText }),
      name: "precision-code-ltd-full-diya-gl.json.zip",
    },
    hubWorkbook: {
      bytes: fs.readFileSync(path.join(LATEST_PACKAGE_DIR, HUB)),
      name: HUB,
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

function ltdUrl() {
  return `${baseUrl}/books/ltd.html`;
}

function money(text) {
  return Number(String(text).replace(/[£,\s]/g, ""));
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

async function uploadPackage(page, bytes, name, mimeType) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ltdUrl(), { waitUntil: "domcontentloaded" });
  await dropFile(page, bytes, name, mimeType);
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

// ── every way in ─────────────────────────────────────────────────────────

test.describe("DIYA-GL Company books page — every way in", () => {
  test("package zip, diya-gl zip, JSON and zipped JSON all land on the same Company book", async ({ page }) => {
    const kinds = [
      ["package-zip", FIXTURES.packageZip],
      ["diya-gl-zip", FIXTURES.diyaGlZip],
      ["json", FIXTURES.json],
      ["json-zip", FIXTURES.jsonZip],
    ];
    for (const [kind, fixture] of kinds) {
      await uploadPackage(page, fixture.bytes, fixture.name);
      await waitForLoaded(page);
      const snapshotTotal = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.annual.sales);
      expect(snapshotTotal, `${kind} snapshot total`).toBeCloseTo(YEAR_TOTAL, 6);

      await page.locator('.tab-btn[data-view="year"]').click();
      const salesCell = page.locator('.year-totals [data-r-key*="MnthP&L!B9"]').first();
      expect(money(await salesCell.textContent()), `${kind} DOM total`).toBeCloseTo(money(YEAR_TOTAL_TEXT), 2);
    }
  });
});

// ── E3: round trips ──────────────────────────────────────────────────────

// Each writer stamps its own entriesComment label -- the page's own upload
// path names the file it was dropped from, export.js names the package it
// read -- so it is the one documentInfo field this comparison leaves out.
function withoutEntriesComment(book) {
  const clone = structuredClone(book);
  if (clone.documentInfo) delete clone.documentInfo.entriesComment;
  return clone;
}

// A saved package's book.toml and lines.jsonl compared to the CLI's own
// extraction of that same zip: not two different tools' opinions of the
// figures, but the same product-workbook.js writer's output read back
// through the same books-interchange.js reader, on the two sides of one zip
// file.
function cliExport(zipBytes, name) {
  const zipPath = path.join(TARGET_DIR, `${name}.zip`);
  const outputDir = path.join(TARGET_DIR, name);
  fs.writeFileSync(zipPath, zipBytes);
  execFileSync(process.execPath, ["app/bin/export.js", "--package", "ltd", "--file", zipPath, "--output-dir", outputDir], {
    cwd: ROOT,
    stdio: "pipe",
  });
  return {
    bookToml: fs.readFileSync(path.join(outputDir, "book.toml"), "utf-8"),
    linesJsonl: fs.readFileSync(path.join(outputDir, "lines.jsonl"), "utf-8"),
  };
}

// Package zip in, D out as the diya-gl zip download, the page's own package
// zip out -- then the CLI reads that package zip the way a customer's own
// re-open would, and its extraction has to equal D byte for byte.
async function roundTrip(page, packageBytes, name) {
  await uploadPackage(page, packageBytes, name);
  await waitForLoaded(page);

  const firstZip = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
  const firstZipFiles = await JSZip.loadAsync(firstZip.bytes);
  const firstBookToml = await firstZipFiles.file("book.toml").async("string");
  const firstLinesJsonl = await firstZipFiles.file("lines.jsonl").async("string");

  const savedPackage = await triggerSaveDownload(page, "Download package (.zip)");
  return { firstBookToml, firstLinesJsonl, savedPackageBytes: savedPackage.bytes };
}

test.describe("DIYA-GL Company books page — round trips (E3)", () => {
  test("E3: package zip -> page -> package zip reproduces D byte for byte on the March book", async ({ page }) => {
    const { firstBookToml, firstLinesJsonl, savedPackageBytes } = await roundTrip(page, FIXTURES.packageZip.bytes, "march-package.zip");

    const cli = cliExport(savedPackageBytes, "e3-march");
    expect(cli.linesJsonl).toBe(firstLinesJsonl);
    expect(withoutEntriesComment(parseTOML(cli.bookToml))).toEqual(withoutEntriesComment(parseTOML(firstBookToml)));
  });

  // ltd-latest's own workbooks already declare their own period (an October
  // year end), so the writer that resaves them targets that same period --
  // no default it has to guess at, and so no gap for a shift to open in. A
  // round trip that did introduce one would fail the same byte comparison.
  test("E3: package zip -> page -> package zip reproduces D byte for byte on ltd-latest, with dates unshifted", async ({ page }) => {
    const { firstBookToml, firstLinesJsonl, savedPackageBytes } = await roundTrip(page, await latestPackageZipBytes(), "ltd-latest.zip");

    const cli = cliExport(savedPackageBytes, "e3-ltd-latest");
    expect(cli.linesJsonl).toBe(firstLinesJsonl);
    expect(withoutEntriesComment(parseTOML(cli.bookToml))).toEqual(withoutEntriesComment(parseTOML(firstBookToml)));
  });

  // T4's own agreement check (app/test/ltd-link-caches.test.js), reused over
  // the package this page just wrote rather than over one saveWorkbookFiles
  // wrote directly: every leaf cell a link addresses has to carry the
  // calculator's own figure, not merely the figure it happened to arrive
  // with.
  test("E3: the saved package's link caches equal the calculator", async ({ page }) => {
    const { savedPackageBytes } = await roundTrip(page, FIXTURES.packageZip.bytes, "march-package-for-caches.zip");

    const outer = await JSZip.loadAsync(savedPackageBytes);
    const zips = new Map();
    for (const name of Object.keys(outer.files).filter((entry) => entry.toLowerCase().endsWith(".xlsx"))) {
      const baseName = name.split("/").pop();
      zips.set(baseName, await JSZip.loadAsync(await outer.file(name).async("uint8array")));
    }

    const taxData = parseTOML(
      fs.readFileSync(
        path.join(ROOT, "app/data", `${taxYearFileName(new Date(fullBook.documentInfo.periodCoveredEnd), "ltd")}.toml`),
        "utf-8",
      ),
    );
    const scenario = diyaGlToScenario(fullBook, fullLines, "ltd");
    const cells = calculateLtdCells(fullBook, fullLines, taxData, scenario);
    const engine = new Map();
    for (const [key, sheet] of Object.entries(cells)) {
      const prefix = key.includes("!") ? key : `${HUB}!${key}`;
      for (const [cell, value] of Object.entries(sheet)) engine.set(`${prefix}!${cell}`, value);
    }

    const caches = await packageLinkCaches(zips, LINK_ORDER.ltd);
    const addressed = new Set(LINK_CELLS_FIXTURE.addressed);
    const blank = new Map(LINK_CELLS_FIXTURE.blank.map((entry) => [entry.key, entry]));

    const disagreements = [];
    let readings = 0;
    for (const [key, entry] of caches) {
      if (!addressed.has(key) || blank.has(key)) continue;
      for (const reading of entry.readings) {
        readings += 1;
        if (canonicalValue(reading.value) !== canonicalValue(engine.get(key))) {
          disagreements.push(`${reading.file} caches ${key} as ${reading.value}, the calculator holds ${engine.get(key)}`);
        }
      }
    }

    expect(disagreements).toEqual([]);
    expect(readings).toBeGreaterThan(2000);
  });
});

// A check that only ever holds proves nothing: an edited line has to move
// the saved package, or the E3 byte comparisons above would pass just as
// happily over a writer that ignored the book entirely.
test.describe("DIYA-GL Company books page — breakability", () => {
  test("an edited line moves the saved package, naming which workbook changed", async ({ page }) => {
    await uploadPackage(page, FIXTURES.packageZip.bytes, "march-package-breakability.zip");
    await waitForLoaded(page);

    const before = await triggerSaveDownload(page, "Download package (.zip)");

    await page.evaluate(async () => {
      const edited = window.DIYA_BOOKS_SNAPSHOT.lines.map((line, i) => (i === 0 ? { ...line, amount: line.amount + 500 } : line));
      await window.DiyaGlBooksPage.setLines(edited, "test: bump the first line by £500");
    });
    await page.waitForFunction(() => window.DIYA_BOOKS_SNAPSHOT.edited === true);

    const after = await triggerSaveDownload(page, "Download package (.zip)");

    const beforeZip = await JSZip.loadAsync(before.bytes);
    const afterZip = await JSZip.loadAsync(after.bytes);
    const changed = [];
    for (const name of Object.keys(beforeZip.files).filter((entry) => entry.endsWith(".xlsx"))) {
      const beforeBytes = await beforeZip.file(name).async("nodebuffer");
      const afterBytes = await afterZip.file(name).async("nodebuffer");
      if (Buffer.compare(beforeBytes, afterBytes) !== 0) changed.push(name);
    }

    console.log(`breakability: bumping the first line by £500 moved ${changed.join(", ")}`);
    expect(changed.length, `workbook entries that moved: ${changed.join(", ")}`).toBeGreaterThan(0);
  });
});

// ── E4: what the page refuses, and what it says ──────────────────────────

test.describe("DIYA-GL Company books page — refusals (E4)", () => {
  test("E4: a lone Financialaccounts.xlsx is refused naming the package zip", async ({ page }) => {
    await uploadPackage(
      page,
      FIXTURES.hubWorkbook.bytes,
      FIXTURES.hubWorkbook.name,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const message = page.locator("#empty-state-message");
    await expect(message).toHaveClass(/upload-error/);
    await expect(message).toHaveText(
      '"Financialaccounts.xlsx" is the hub workbook of a multi-file Company package; upload the package zip.',
    );
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);
  });

  test("E4: a BST workbook lands on the BST manifest, not the Ltd one", async ({ page }) => {
    await uploadPackage(
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

test.describe("DIYA-GL Company books page — downloads (E5)", () => {
  test("E5: the package zip holds thirteen workbooks and the docx, every workbook with fullCalcOnLoad, no PDF", async ({ page }) => {
    await uploadPackage(page, FIXTURES.packageZip.bytes, "precision-code-ltd-full-package.zip");
    await waitForLoaded(page);

    const packageZip = await triggerSaveDownload(page, "Download package (.zip)");
    const zip = await JSZip.loadAsync(packageZip.bytes);
    const entries = Object.keys(zip.files).map((name) => name.split("/").pop());

    const workbooks = entries.filter((name) => name.endsWith(".xlsx"));
    const docs = entries.filter((name) => name.endsWith(".docx"));
    const pdfs = entries.filter((name) => name.toLowerCase().endsWith(".pdf"));

    expect(workbooks.length).toBe(13);
    expect(docs).toEqual(["Dividend Voucher.docx"]);
    expect(pdfs).toEqual([]);

    for (const name of Object.keys(zip.files).filter((entry) => entry.toLowerCase().endsWith(".xlsx"))) {
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
    expect(document.product).toBe("ltd");
  });
});
