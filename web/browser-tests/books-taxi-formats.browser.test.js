// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-taxi-formats.browser.test.js
//
// E3 and E4 from PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md's test approach: every way
// a file reaches the Taxi page, sniffed by content, and the round trip's own
// three named lossy rules.
//
// The five format fixtures (workbook, package zip with its PDF guide beside
// the workbook, diya-gl zip, JSON, zipped JSON) are all built from the SAME
// underlying data -- examples/taxi-latest's own workbook, re-extracted with
// export.js -- rather than from the live examples/basic-taxi-driver/taxi
// fixture. The two currently disagree (see books-taxi-equivalence's own A3
// comment: taxi-latest predates a handful of fixes due at the next
// generate-taxi.yml refresh), so building the diya-gl/JSON fixtures from the
// live fixture while dropping the taxi-latest workbook would make "all five
// land on the same book" fail for a reason that has nothing to do with the
// format loader this test is about.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { validateTaxiAnchors } from "../../app/lib/anchors/taxi.js";
import { AnchorError } from "../../app/lib/anchors/run.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const BUNDLE = path.join(PUBLIC_DIR, "books/engine/diya-gl-engine.js");
const TARGET_DIR = path.join(ROOT, "target", "books-taxi-formats");
fs.mkdirSync(TARGET_DIR, { recursive: true });

const WORKBOOK_PATH = path.join(ROOT, "examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx");
const BST_WORKBOOK_PATH = path.join(ROOT, "examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx");

const workbookBytes = fs.readFileSync(WORKBOOK_PATH);

// The diya-gl data examples/taxi-latest's own workbook carries, re-extracted
// with the CLI so the diya-gl zip/JSON fixtures below describe exactly the
// book the workbook fixture does -- the same book, five different shapes.
const extractedDir = path.join(TARGET_DIR, "extracted");
execFileSync(process.execPath, ["app/bin/export.js", "--package", "taxi", "--file", WORKBOOK_PATH, "--output-dir", extractedDir], {
  cwd: ROOT,
  stdio: "pipe",
});
const taxiBookToml = fs.readFileSync(path.join(extractedDir, "book.toml"), "utf-8");
const taxiLinesJsonl = fs.readFileSync(path.join(extractedDir, "lines.jsonl"), "utf-8");

async function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

// A minimal, valid PDF -- header and end-of-file marker only. The loader
// only has to find the workbook among the zip's entries and ignore
// everything else; what the PDF itself contains is not this test's concern.
const GUIDE_PDF_BYTES = Buffer.from("%PDF-1.4\n%%EOF\n", "utf-8");

let FIXTURES;

let closeServer;
let baseUrl;

test.beforeAll(async ({ browser }) => {
  if (!fs.existsSync(BUNDLE)) {
    throw new Error(`No bundle at ${BUNDLE}. Run: node scripts/build-books-bundle.mjs`);
  }
  const server = await startStaticServer(PUBLIC_DIR);
  baseUrl = server.baseUrl;
  closeServer = server.close;

  FIXTURES = {
    workbook: { bytes: workbookBytes, name: "GB_Accounts_Taxi_Driver.xlsx" },
    packageZip: {
      bytes: await zipOf({ "GB_Accounts_Taxi_Driver.xlsx": workbookBytes, "Taxi Driver User Guide.pdf": GUIDE_PDF_BYTES }),
      name: "taxi-package.zip",
    },
    diyaGlZip: {
      bytes: await zipOf({ "book.toml": taxiBookToml, "lines.jsonl": taxiLinesJsonl, "report.json": "{}\n" }),
      name: "taxi-diya-gl.zip",
    },
    xls: {
      bytes: Buffer.concat([Buffer.from("D0CF11E0A1B11AE1", "hex"), Buffer.alloc(504)]),
      name: "legacy-taxi-accounts.xls",
    },
  };

  // The JSON fixture is the page's own diya-gl-books document for the same
  // workbook, built once here off a real load (rather than typed out) so it
  // is exactly what the JSON/JSON-zip drops in the tests below are proving
  // equivalent to the workbook.
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/books/taxi.html`, { waitUntil: "domcontentloaded" });
  await dropFile(page, FIXTURES.workbook.bytes, FIXTURES.workbook.name);
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
  const jsonBytes = (await triggerSaveDownload(page, "Download books as JSON (.json)")).bytes;
  FIXTURES.json = { bytes: jsonBytes, name: "taxi-diya-gl.json" };
  FIXTURES.jsonZip = { bytes: await zipOf({ "book.json": jsonBytes.toString("utf-8") }), name: "taxi-diya-gl.json.zip" };
  await page.close();
});

test.afterAll(async () => {
  await closeServer();
});

function taxiUrl() {
  return `${baseUrl}/books/taxi.html`;
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

async function readSnapshotTotal(page) {
  return page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.annual.sales);
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
  const bytes = await readDownload(download);
  return { download, bytes };
}

// ── E4: every way in ───────────────────────────────────────────────────────

test.describe("DIYA-GL Taxi books page — every way in", () => {
  test("the Taxi workbook, its package zip (with the PDF guide), the diya-gl zip, the JSON and the zipped JSON all load to the same book", async ({
    page,
  }) => {
    await page.goto(taxiUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.workbook.bytes, FIXTURES.workbook.name);
    await waitForLoaded(page);
    const workbookTotal = await readSnapshotTotal(page);
    expect(workbookTotal).toBeGreaterThan(0);

    const kinds = [
      ["package-zip", FIXTURES.packageZip],
      ["diya-gl-zip", FIXTURES.diyaGlZip],
      ["json", FIXTURES.json],
      ["json-zip", FIXTURES.jsonZip],
    ];
    for (const [kind, fixture] of kinds) {
      await page.goto(taxiUrl(), { waitUntil: "domcontentloaded" });
      await dropFile(page, fixture.bytes, fixture.name);
      await waitForLoaded(page);
      expect(await readSnapshotTotal(page), `${kind} snapshot total`).toBe(workbookTotal);
    }
  });

  test("the legacy .xls is refused, naming the fix, not read as anything else", async ({ page }) => {
    await page.goto(taxiUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.xls.bytes, FIXTURES.xls.name);
    await expect(page.locator("#empty-state-message")).toContainText("older .xls format");
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);
  });
});

// A Basic Sole Trader workbook uploaded on the Taxi page actually sniffs as
// bst and loads fine there -- shell.js mounts whichever product's own
// manifest the upload matches (see loadManifest/ensureManifest), the same
// way a Taxi workbook dropped on bst.html loads as Taxi. The refusal this
// case is about lives one level down, where a product is not being sniffed
// but asserted: export.js/report.js's own --package taxi, and the MCP
// server's product-scoped tools, read a file straight through Taxi's own
// anchor table rather than falling back to BST's. This proves that table's
// own refusal names the sheet a BST workbook is missing.
test.describe("DIYA-GL Taxi anchors — a Basic Sole Trader workbook is refused by name", () => {
  test("validateTaxiAnchors refuses a real BST workbook, naming Draft Tax calculation", async () => {
    const bstBytes = fs.readFileSync(BST_WORKBOOK_PATH);
    let caught = null;
    try {
      await validateTaxiAnchors(bstBytes);
    } catch (error) {
      caught = error;
    }
    expect(caught, "validateTaxiAnchors did not throw on a real BST workbook").toBeInstanceOf(AnchorError);
    expect(caught.message).toContain("Draft Tax calculation");
  });
});

// ── E3: the round trip is lossy by exactly three rules ──────────────────────
//
// A day with two fares writes one row: the sum and the joined names. A
// rental or "Any other income" caption line is written to its week's own
// caption row, whose date is fixed by the sheet's own pre-filled grid (the
// week's last day) regardless of what date the line carried going in --
// so re-extracting the workbook reads that row's own date back, not the
// line's original one. Every other line is untouched. The week of Monday 9
// June to Sunday 15 June 2025 is a full week in the middle of the tax year
// (clear of both the partial first and last weeks), so "the week's last
// day" and "its Sunday" name the same date here.

const WEEK_LAST_DAY = "2025-06-15";
const TWO_FARE_DAY = "2025-06-11"; // TXN-0045, an existing weekday fare
const RENTAL_DATE = "2025-06-11"; // deliberately not the week's own last day
const OTHER_INCOME_DATE = "2025-06-12"; // likewise

function lineTuple(line) {
  return [line.sourceJournalID, line.postingDate, String(line.accountMainID), line.amount, line.detailComment || ""].join("|");
}

test.describe("DIYA-GL Taxi books page — the round trip is lossy by exactly three rules (E3)", () => {
  test("a two-fare day, a rental and a grant added through the page survive as three known transformations, nothing else", async ({
    page,
  }) => {
    await page.goto(taxiUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /taxi-scenario-basic/ }).click();
    await waitForLoaded(page);

    const before = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.lines);
    const twoFareDayBefore = before.filter((l) => l.sourceJournalID === "sales" && l.postingDate === TWO_FARE_DAY);
    expect(twoFareDayBefore, "the chosen day starts with exactly one fare").toHaveLength(1);
    const originalFareSum = twoFareDayBefore.reduce((sum, l) => sum + l.amount, 0);

    const added = [
      { sourceJournalID: "sales", postingDate: TWO_FARE_DAY, accountMainID: "4000", amount: 65, documentType: "receipt", detailComment: "Airport run" },
      { sourceJournalID: "sales", postingDate: RENTAL_DATE, accountMainID: "4000", amount: 150, documentType: "invoice", detailComment: "Rental due" },
      {
        sourceJournalID: "sales",
        postingDate: OTHER_INCOME_DATE,
        accountMainID: "4001",
        amount: 80,
        documentType: "invoice",
        detailComment: "Any other income",
      },
    ].map((line, i) => ({ entryNumber: `E3-NEW-${i}`, ...line }));

    await page.evaluate(async (added) => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      await window.DiyaGlBooksPage.setLines(snapshot.lines.concat(added), "test: E3 fixture lines");
    }, added);
    await page.waitForFunction(() => window.DIYA_BOOKS_SNAPSHOT.edited === true);

    // page -> workbook
    const firstWorkbook = await triggerSaveDownload(page, "Download taxi-excel.xlsx");
    const firstWorkbookPath = path.join(TARGET_DIR, "e3-first.xlsx");
    fs.writeFileSync(firstWorkbookPath, firstWorkbook.bytes);

    // workbook -> page
    await page.goto(taxiUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, firstWorkbook.bytes, "e3-first.xlsx");
    await waitForLoaded(page);

    // page -> zip, read back as D
    const zip = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const zipFiles = await JSZip.loadAsync(zip.bytes);
    const linesJsonl = await zipFiles.file("lines.jsonl").async("string");
    const after = linesJsonl
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

    // Rule 1: the two-fare day collapses to one line, sum preserved, names joined.
    const twoFareDayAfter = after.filter((l) => l.sourceJournalID === "sales" && l.postingDate === TWO_FARE_DAY);
    expect(twoFareDayAfter, `${TWO_FARE_DAY} carries exactly one line after the round trip`).toHaveLength(1);
    expect(twoFareDayAfter[0].amount).toBeCloseTo(originalFareSum + 65, 2);
    expect(twoFareDayAfter[0].detailComment).toBe("Daily fares; Airport run");

    // Rule 2: the rental line is dated the week's last day, not the date it went in on.
    const rentalAfter = after.filter((l) => l.sourceJournalID === "sales" && l.accountMainID === "4000" && l.detailComment === "Rental due");
    expect(rentalAfter).toHaveLength(1);
    expect(rentalAfter[0].postingDate).toBe(WEEK_LAST_DAY);
    expect(rentalAfter[0].amount).toBeCloseTo(150, 2);

    // Rule 3: likewise the "Any other income" grant.
    const otherIncomeAfter = after.filter((l) => l.sourceJournalID === "sales" && l.accountMainID === "4001");
    expect(otherIncomeAfter).toHaveLength(1);
    expect(otherIncomeAfter[0].postingDate).toBe(WEEK_LAST_DAY);
    expect(otherIncomeAfter[0].amount).toBeCloseTo(80, 2);

    // And by nothing else: every other line's own (journal, date, account,
    // amount, detail) tuple survives untouched -- entryNumber aside, since a
    // full extraction renumbers every line, collapsed or not.
    const touchedBefore = new Set([TWO_FARE_DAY, RENTAL_DATE, OTHER_INCOME_DATE].map((d) => d));
    const untouchedBeforeTuples = before
      .concat(added)
      .filter((l) => !(l.sourceJournalID === "sales" && touchedBefore.has(l.postingDate)))
      .map(lineTuple)
      .sort();
    const untouchedAfterTuples = after
      .filter((l) => !(l.sourceJournalID === "sales" && (l.postingDate === TWO_FARE_DAY || l.postingDate === WEEK_LAST_DAY)))
      .map(lineTuple)
      .sort();
    expect(untouchedAfterTuples).toEqual(untouchedBeforeTuples);
  });

  test("JSON -> page -> JSON is identical", async ({ page }) => {
    await page.goto(taxiUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, FIXTURES.json.bytes, FIXTURES.json.name);
    await waitForLoaded(page);
    const jsonOut = await triggerSaveDownload(page, "Download books as JSON (.json)");
    expect(jsonOut.bytes.toString("utf-8")).toBe(FIXTURES.json.bytes.toString("utf-8"));
  });
});
