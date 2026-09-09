// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/books-ltd-equivalence.browser.test.js
//
// The A-series for the Company page (books/ltd.html): does the browser show
// the reader what the reconciliation proved, over a package of thirteen
// workbooks joined by twenty-two external links.
//
// r-sources.js supplies S1 (a fixture's own totals), S2 (the JS engine over a
// book's diya-gl data) and S3 (the saved ltd-latest package's cached cells).
// A3 joins S3 against S2 over the book that same package exports; A4 joins S2
// against every figure the page renders; A6 joins S1 against S2; A7 drives
// the drift and link layers off an uploaded package.
//
// No example is registered for Ltd yet, so all three books reach the page as
// a diya-gl zip built here from the same directory report.js reads.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { s1, s2ForPackage, s3, s3YearEnd, canonical, parseFigure, SCENARIOS_LTD } from "./r-sources.js";
import { loadDiyaGlData } from "../../app/lib/diya-gl-loader.js";
import { externalLinks, HUB_FILE } from "../../app/lib/link-caches.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const PACKAGE_DIR = path.join(ROOT, "examples/ltd-latest");
const TARGET_DIR = path.join(ROOT, "target", "books-ltd-equivalence");

fs.mkdirSync(TARGET_DIR, { recursive: true });

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

function ltdUrl() {
  return `${baseUrl}/books/ltd.html`;
}

function periodEndOf(bookDir) {
  const { book } = loadDiyaGlData(path.join(ROOT, bookDir));
  return new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);
}

// S2 for a Company book on the tax data the page itself loads: the year file
// taxYearFileName names for the book's own period, which is what
// s2ForPackage asks report.js for. The bare --data path instead reads
// whatever the book.toml's [tax] section carries, which report.js's own log
// calls the imprecise route.
function ltdReport(example) {
  return s2ForPackage(example.bookDir, periodEndOf(example.bookDir), example.scenario, "ltd");
}

// ── Getting a book, and a package, onto the page ──────────────────────────

async function diyaGlZipOf(bookDir) {
  const zip = new JSZip();
  zip.file("book.toml", fs.readFileSync(path.join(ROOT, bookDir, "book.toml")));
  zip.file("lines.jsonl", fs.readFileSync(path.join(ROOT, bookDir, "lines.jsonl")));
  zip.file("report.json", "{}\n");
  return zip.generateAsync({ type: "nodebuffer" });
}

function packageWorkbookNames() {
  return fs.readdirSync(PACKAGE_DIR).filter((file) => file.endsWith(".xlsx"));
}

async function ltdLatestZipBytes(overrides) {
  const zip = new JSZip();
  for (const name of packageWorkbookNames()) {
    zip.file(name, (overrides && overrides[name]) || fs.readFileSync(path.join(PACKAGE_DIR, name)));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function dropFile(page, bytes, name) {
  const base64 = bytes.toString("base64");
  await page.evaluate(
    ({ base64, name }) => {
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const file = new File([array], name, { type: "application/zip" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const target = document.querySelector(".empty-state") || document.body;
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { base64, name },
  );
}

async function waitForLoaded(page) {
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function openBook(page, example) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ltdUrl(), { waitUntil: "domcontentloaded" });
  await dropFile(page, await diyaGlZipOf(example.bookDir), `${example.scenario}-diya-gl.zip`);
  await waitForLoaded(page);
}

async function uploadPackage(page, bytes, name) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ltdUrl(), { waitUntil: "domcontentloaded" });
  await dropFile(page, bytes, name);
  await waitForLoaded(page);
}

// ── The page sweep: every data-r-key on every view, both drill levels ─────

// A form box whose figure the layout builds from more than one cell -- box
// 705 is CorporationTax!I16 plus I17, the published administrative expenses
// are the management sheet's own lines less the ones printed above -- names
// every cell its rule reads, so its text is no single key's figure. Those
// boxes are the Ltd forms spec's subject (books-ltd-forms.browser.test.js
// checks each against the layout); here they are provenance, not a figure.
// Every cell a form box's rule combines or transforms, off the layout the
// six form views render from: a box built by a rule prints the rule's answer,
// which is not the value of any cell it names. positivePartOf(...) and its
// twin wrap a cell reference in the layout's own grammar.
const FORM_LAYOUT = JSON.parse(fs.readFileSync(path.join(ROOT, "app/data/hmrc/form-layouts/ltd.json"), "utf-8"));
const DERIVED_BOX_CELLS = new Set();
(function collectDerived(node) {
  if (Array.isArray(node)) return node.forEach(collectDerived);
  if (!node || typeof node !== "object") return;
  if (node.op && Array.isArray(node.cells)) {
    for (const cell of node.cells)
      DERIVED_BOX_CELLS.add(
        `cell/${String(cell)
          .replace(/^[A-Za-z]+\(/, "")
          .replace(/\)$/, "")}`,
      );
  }
  for (const value of Object.values(node)) collectDerived(value);
})(FORM_LAYOUT.forms);

function namesOneCell(raw) {
  return raw.split(" || ").filter((key) => key.startsWith("cell/")).length <= 1;
}

async function collectRenderedFigures(page, running) {
  const found = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-r-key]")).map((el) => ({
      raw: el.getAttribute("data-r-key"),
      text: el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ? el.value : el.textContent,
      className: el.className,
      // A figure inside an HMRC form box prints whole pounds, so it compares
      // at the precision the box itself declares.
      wholePounds: el.classList.contains("form-amount-box"),
    }));
  });
  for (const { raw, text, className, wholePounds } of found) {
    if (!namesOneCell(raw)) continue;
    for (const key of raw.split(" || ")) running.set(key, { text, className, wholePounds });
  }
}

async function openEveryMonth(page, running) {
  const monthCount = await page.locator(".year-row").count();
  for (let i = 0; i < monthCount; i++) {
    await page.locator(".year-row").nth(i).click();
    const entriesToggle = page.locator("#entries-toggle");
    if (await entriesToggle.count()) await entriesToggle.click();
    await collectRenderedFigures(page, running);
  }
}

async function sweepPage(page, example) {
  await openBook(page, example);
  const viewIds = await page.evaluate(() => window.DiyaGlBooksPage.manifest.views.map((view) => view.id));

  const running = new Map();
  for (const view of viewIds) {
    await page.locator(`.tab-btn[data-view="${view}"]`).click();
    await expect(page.locator(`.tab-btn[data-view="${view}"]`)).toHaveAttribute("aria-selected", "true");
    await collectRenderedFigures(page, running);
    if (view === "year") await openEveryMonth(page, running);
  }
  return running;
}

// ── A3: the sheet agrees ─────────────────────────────────────────────────
//
// S2's side is the book examples/ltd-latest itself exports: export.js reads
// the same thirteen workbooks the page reads, and report.js recomputes R
// from exactly the entries they carry. Running the master fixture directory
// instead would compare two different books -- the master has moved on since
// the package was cut, and --offset shifts posting dates only, leaving the
// book's own declared dates behind.
//
// Two families of shared keys disagree, each named and asserted rather than
// dropped:
//
// 1. The package declares an accounting period a year ahead of the postings
//    it carries: its Admin year-end seed says 31 October 2027 and its bank
//    lines run November 2025 to October 2026. That is the period shift this
//    row fixed in app/products/ltd.js; until generate-ltd.yml refreshes the
//    package, every cell the workbook derives from its own year end sits a
//    year ahead of the same cell derived from the entries. Each such key has
//    to differ by exactly a year -- a wrong figure in this family still
//    fails -- and the family empties itself when the refresh lands.
//
// 2. Vatreturns.xlsx carries the fixture's straddling VAT periods, the two
//    quarters before the accounting year and the three after it. S2 here is
//    the book the package exports, and the export reads the twelve month
//    tabs rather than Vat.xlsx's own out-of-year entry sheets, so those rows
//    come back nil. The package can only hold more VAT than the book, never
//    less.

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

function excelSerialAsDate(serial) {
  return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY);
}

// A saved read carries no compliance verdict and no journal-category VAT
// netting: --mode saved reads the workbooks' own cached cells, with no
// scenario and no journal lines beside them.
const SAVED_MODE_CANNOT_CARRY = ["check/", "section/journal-category-vat-netting/"];

// Vatinterface rows 4, 5 and 18 to 20 are the straddling periods themselves;
// rows 6 and 7 are the quarters that sum the two before the year, and
// VATQtr5 is the return that reads the three after it.
const STRADDLING_INTERFACE_ROWS = [4, 5, 6, 7, 18, 19, 20];

function isStraddlingKey(key) {
  const interfaceCell = /^cell\/Vatreturns\.xlsx!Vatinterface![A-Z]+(\d+)$/.exec(key);
  if (interfaceCell) return STRADDLING_INTERFACE_ROWS.includes(Number(interfaceCell[1]));
  return key.startsWith("cell/Vatreturns.xlsx!VATQtr5!") || key.startsWith("section/vat-returns/");
}

// The officer register the package holds and the book it exports do not
// describe the same officers: the package names a company secretary on row 3
// and leaves the director's appointment date blank, and the book carries the
// date and one officer. Neither side is the year skew and neither is
// straddling VAT, so both keys are named here.
const OFFICER_REGISTER_ONLY_IN_S3 = ["cell/Companysecretary.xlsx!Directors&Secretary!D3"];
const OFFICER_REGISTER_ONLY_IN_S2 = ["cell/Companysecretary.xlsx!Directors&Secretary!C2"];

// A key whose slug names its own period end: the year skew makes the two
// sides name different keys rather than different values.
const DATED_SLUG = /^section\/vat-returns\/q\d-period-ending-/;

function aYearApart(s3Value, s2Value) {
  const later = Number(s3Value);
  const earlier = Number(s2Value);
  // A printed period reads "30 November 2026, 31 December 2026, ...": the
  // same prose with every year one lower is the same skew.
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) {
    const rolledBack = String(s3Value).replace(/\b(19|20)\d{2}\b/g, (year) => String(Number(year) - 1));
    return rolledBack !== String(s3Value) && rolledBack === String(s2Value);
  }
  // A date serial moves a whole year; a financial-year label moves by one.
  if (later - earlier === 1 && later > 1900 && later < 2100) return true;
  if (later <= 0 || earlier <= 0) return false;
  const shifted = excelSerialAsDate(earlier);
  shifted.setUTCFullYear(shifted.getUTCFullYear() + 1);
  return Math.round((shifted.getTime() - EXCEL_EPOCH_MS) / MS_PER_DAY) === later;
}

test.describe("DIYA-GL Company books page — the sheet agrees (A3)", () => {
  test("S3 (ltd-latest, saved) equals S2 for every shared key", () => {
    const s3Map = s3("ltd");

    const exported = path.join(TARGET_DIR, "a3-ltd-latest-export");
    execFileSync(
      process.execPath,
      ["app/bin/export.js", "--package", "ltd", "--source-dir", "examples/ltd-latest", "--output-dir", exported],
      {
        cwd: ROOT,
        stdio: "pipe",
      },
    );
    const s2Map = s2ForPackage(exported, s3YearEnd("ltd"), "ltd-latest-export", "ltd");

    const onlyS2 = [...s2Map.keys()].filter((key) => !s3Map.has(key));
    const onlyS3 = [...s3Map.keys()].filter((key) => !s2Map.has(key));
    const onlyS2Unexplained = onlyS2.filter(
      (key) =>
        !SAVED_MODE_CANNOT_CARRY.some((prefix) => key.startsWith(prefix)) &&
        !OFFICER_REGISTER_ONLY_IN_S2.includes(key) &&
        !DATED_SLUG.test(key),
    );
    const onlyS3Unexplained = onlyS3.filter((key) => !DATED_SLUG.test(key) && !OFFICER_REGISTER_ONLY_IN_S3.includes(key));

    let compared = 0;
    let periodAhead = 0;
    let straddling = 0;
    const mismatches = [];
    for (const [key, s3Entry] of s3Map) {
      const s2Entry = s2Map.get(key);
      if (!s2Entry) continue;
      compared++;
      const unit = s3Entry.unit ?? s2Entry.unit;
      const excelValue = canonical(s3Entry.value, unit);
      const jsValue = canonical(s2Entry.value, unit);
      if (excelValue === jsValue) continue;

      if (aYearApart(excelValue, jsValue)) {
        periodAhead++;
        continue;
      }
      if (isStraddlingKey(key) && Number(excelValue) >= Number(jsValue)) {
        straddling++;
        continue;
      }
      mismatches.push({ key, excelValue, jsValue });
    }

    console.log(`A3: ${compared} shared keys compared between S3 (year-end ${s3YearEnd("ltd")}) and S2 over the book it exports`);
    console.log(
      `A3: ${periodAhead} carry the package's own period, which sits a year ahead of its postings until generate-ltd.yml refreshes it`,
    );
    console.log(`A3: ${straddling} carry the fixture's straddling VAT periods, which the exported book does not hold`);
    console.log(`A3: ${onlyS2.length} keys in S2 only, ${onlyS3.length} keys in S3 only`);

    expect(mismatches, `mismatches:\n${mismatches.map((m) => `${m.key}: S3=${m.excelValue} S2=${m.jsValue}`).join("\n")}`).toEqual([]);
    expect(onlyS2Unexplained, `S2-only keys a saved read should have carried:\n${onlyS2Unexplained.join("\n")}`).toEqual([]);
    expect(onlyS3Unexplained, `S3-only keys:\n${onlyS3Unexplained.join("\n")}`).toEqual([]);
    expect(compared).toBeGreaterThan(1500);
    expect(straddling).toBeGreaterThan(0);
  });
});

// ── A4: the screen agrees ────────────────────────────────────────────────

// A figure that starts agreeing fails here too, which is the point: the list
// shrinks as they are fixed.
const KNOWN_PAGE_DISAGREEMENTS = [];

test.describe("DIYA-GL Company books page — the screen agrees (A4)", () => {
  for (const example of SCENARIOS_LTD) {
    test(`${example.scenario}: every rendered figure matches S2`, async ({ page }) => {
      const s2Map = ltdReport(example);
      const rendered = await sweepPage(page, example);

      let compared = 0;
      let derived = 0;
      const mismatches = [];
      for (const [key, { text, className, wholePounds }] of rendered) {
        const s2Entry = s2Map.get(key);
        // Render coverage -- every rendered key being one S2 carries -- is
        // its own sweep (books-render-coverage.browser.test.js).
        if (!s2Entry) continue;
        if (wholePounds && DERIVED_BOX_CELLS.has(key)) {
          derived++;
          continue;
        }
        compared++;

        if (key.startsWith("check/")) {
          const classNames = String(className).split(/\s+/);
          const verdict = classNames.includes("fail")
            ? "fail"
            : classNames.includes("warn")
              ? "warn"
              : classNames.includes("pass")
                ? "pass"
                : null;
          if (verdict !== s2Entry.value) {
            mismatches.push(`${key}: rendered verdict "${verdict}" (class "${className}"), S2 says "${s2Entry.value}"`);
          }
          continue;
        }

        if (!["money", "rate", "count"].includes(s2Entry.unit)) continue;
        const parsed = parseFigure(text);
        if (Number.isNaN(parsed.value)) continue;

        // A rate reaches R in the scale its own cell holds -- the Report's
        // margins as a fraction, the Admin and CT rate cells as whole
        // percent -- and prints as a percentage rounded to the places the
        // page shows. Both sides come back to that scale and precision.
        if (s2Entry.unit === "rate") {
          const printed = /\.(\d+)%?$/.exec(String(text).trim());
          const places = printed ? printed[1].length : 6;
          const shownRate = parsed.value * 100;
          const expectedRate = Math.abs(Number(s2Entry.value)) > 1 ? Number(s2Entry.value) : Number(s2Entry.value) * 100;
          if (shownRate.toFixed(places) !== expectedRate.toFixed(places)) {
            mismatches.push(`${key}: rendered "${text}" -> ${shownRate.toFixed(places)}%, S2 says ${expectedRate.toFixed(places)}%`);
          }
          continue;
        }

        const expected =
          wholePounds && s2Entry.unit === "money" ? String(Math.round(Number(s2Entry.value))) : canonical(s2Entry.value, s2Entry.unit);
        const shown = wholePounds && s2Entry.unit === "money" ? String(Math.round(parsed.value)) : canonical(parsed.value, s2Entry.unit);
        if (shown !== expected) mismatches.push(`${key}: rendered "${text}" -> ${shown}, S2 says ${expected}`);
      }

      console.log(`A4 (${example.scenario}): ${compared} figures compared against S2's ${s2Map.size} keys`);
      console.log(`A4 (${example.scenario}): ${derived} form boxes left to the forms spec, which prints the layout's rule, not one cell`);

      const unexpected = mismatches.filter((line) => !KNOWN_PAGE_DISAGREEMENTS.some((key) => line.startsWith(`${key}:`)));
      const stillOpen = KNOWN_PAGE_DISAGREEMENTS.filter((key) => mismatches.some((line) => line.startsWith(`${key}:`)));
      console.log(`A4 (${example.scenario}): open page-side figures still disagreeing: ${stillOpen.join(", ") || "none"}`);

      expect(unexpected, `A4 mismatches:\n${unexpected.join("\n")}`).toEqual([]);
      expect(compared).toBeGreaterThan(0);
    });
  }
});

// ── A6: the fixture holds ────────────────────────────────────────────────
//
// Every [expected] total the three Ltd fixtures declare that ltd.js's
// checkCompliance anchors to one workbook cell: "Total Sales" (MnthP&L!B9),
// "Premises" (B21) and "Legal & Professional" (B33). The VAT totals the
// BrickWork fixtures also declare are sums over the return, not one cell, so
// they are left to the reconciliation's own checks.
const EXPECTED_KEY_MAP = {
  total_sales: "cell/Financialaccounts.xlsx!MnthP&L!B9",
  total_premises_net: "cell/Financialaccounts.xlsx!MnthP&L!B21",
  total_legal_net: "cell/Financialaccounts.xlsx!MnthP&L!B33",
};

test.describe("DIYA-GL Company books page — the fixture holds (A6)", () => {
  for (const example of SCENARIOS_LTD) {
    test(`${example.scenario}: S1's totals equal S2's cells`, () => {
      const expected = s1(example.scenario);
      const s2Map = ltdReport(example);

      let compared = 0;
      const mismatches = [];
      for (const [expectedKey, cellKey] of Object.entries(EXPECTED_KEY_MAP)) {
        if (expected[expectedKey] === undefined) continue;
        const entry = s2Map.get(cellKey);
        if (!entry) {
          mismatches.push(`${expectedKey}: S2 carries no ${cellKey}`);
          continue;
        }
        compared++;
        const fixtureValue = canonical(expected[expectedKey], entry.unit);
        const s2Value = canonical(Math.round(Number(entry.value)), entry.unit);
        if (fixtureValue !== s2Value) mismatches.push(`${expectedKey} (${cellKey}): fixture ${fixtureValue}, S2 ${s2Value}`);
      }

      expect(mismatches, mismatches.join("\n")).toEqual([]);
      expect(compared).toBeGreaterThan(1);
    });
  }
});

// ── A7: a true package upload ────────────────────────────────────────────
//
// A Company package has nine workbooks that read another across a link, and
// every one of them caches what it read. The page's drift layer reads all
// nine, so a cache left behind in Vatreturns is named on Vatreturns' own
// cell, not missed because the hub's copy is fresh.
//
// Sales.xlsx's November tab is the first month of this package's year.
// Its O1 is cached by the hub alone, under TrialBalance!F53 and Stock!J8;
// its G1 is cached twice, by the hub under TrialBalance!F33 and by
// Vatreturns under Vatinterface!F6. So one leaf cell proves both halves.
const FIRST_TAB = "Nov";
const LEAF_ONLY_THE_HUB_READS = { sheet: FIRST_TAB, cell: "O1" };
const LEAF_TWO_WORKBOOKS_READ = { sheet: FIRST_TAB, cell: "G1" };
const HUB_MARKS_FOR_O1 = ["Financialaccounts.xlsx!Stock!J8", "Financialaccounts.xlsx!TrialBalance!F53"];

function driftFromPage(page) {
  return page.evaluate(() =>
    window.DIYA_BOOKS_SNAPSHOT.drift.map((entry) => ({
      id: entry.id,
      state: entry.state,
      file: entry.file,
      leaf: entry.leaf,
      asRead: entry.asRead,
      computed: entry.computed,
    })),
  );
}

// A copy of one workbook with a cell's own cached value bent: the leaf then
// holds a figure its formula no longer produces, which is what a customer
// leaves behind by editing a cell and never recalculating.
async function workbookWithBentCell(fileName, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(PACKAGE_DIR, fileName)));
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const tag = [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)].find((m) => m[1].includes(`name="${sheetName}"`));
  expect(tag, `${fileName} has a sheet named ${sheetName}`).toBeTruthy();
  const rid = /r:id="([^"]+)"/.exec(tag[1])[1];
  const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(relsXml)[1];
  const sheetPath = `xl/${target.replace(/^\.?\//, "")}`;
  const xml = await zip.file(sheetPath).async("string");
  const cell = new RegExp(`(<c\\s+r="${cellRef}"[^>]*>)([\\s\\S]*?)(</c>)`).exec(xml);
  expect(cell, `${fileName}!${sheetName}!${cellRef} carries a cached value`).not.toBeNull();
  zip.file(sheetPath, xml.replace(cell[0], cell[1] + cell[2].replace(/<v>[\s\S]*?<\/v>/, `<v>${newValue}</v>`) + cell[3]));
  return zip.generateAsync({ type: "nodebuffer" });
}

// A copy of one workbook with its cached copy of another workbook's cell
// bent: the reader then quotes a figure the leaf itself no longer holds,
// which is what a customer leaves behind by saving a leaf without reopening
// the workbook that reads it.
async function workbookWithBentCache(readerFile, targetFile, sheetName, cellRef) {
  const reader = await JSZip.loadAsync(fs.readFileSync(path.join(PACKAGE_DIR, readerFile)));
  const link = (await externalLinks(reader)).find((entry) => entry.targetFile === targetFile);
  expect(link, `${readerFile} links ${targetFile}`).toBeTruthy();
  const sheetId = link.sheetNames.indexOf(sheetName);
  const xml = await reader.file(link.path).async("string");
  const block = new RegExp(`<sheetData\\s+sheetId="${sheetId}"[^>]*>[\\s\\S]*?</sheetData>`).exec(xml)[0];
  const cached = new RegExp(`<cell r="${cellRef}"><v>([^<]*)</v></cell>`).exec(block);
  expect(cached, `${readerFile} caches ${targetFile}!${sheetName}!${cellRef}`).not.toBeNull();
  const bent = block.replace(cached[0], `<cell r="${cellRef}"><v>${Number(cached[1]) + 1000}</v></cell>`);
  reader.file(link.path, xml.replace(block, bent));
  return reader.generateAsync({ type: "nodebuffer" });
}

test.describe("DIYA-GL Company books page — a true package upload (A7)", () => {
  test("a fresh ltd-latest upload carries no drift and no stale cache of its own", async ({ page }) => {
    await uploadPackage(page, await ltdLatestZipBytes(), "ltd-latest.zip");
    expect((await driftFromPage(page)).map((entry) => `${entry.state} ${entry.id} <- ${entry.leaf}`)).toEqual([]);
  });

  test("a corrupted leaf cell shows exactly that cell's drift", async ({ page }) => {
    await uploadPackage(page, await ltdLatestZipBytes(), "ltd-latest.zip");
    const before = new Set((await driftFromPage(page)).map((entry) => `${entry.state} ${entry.id}`));

    const bent = await workbookWithBentCell("Sales.xlsx", LEAF_ONLY_THE_HUB_READS.sheet, LEAF_ONLY_THE_HUB_READS.cell, 999999);
    await uploadPackage(page, await ltdLatestZipBytes({ "Sales.xlsx": bent }), "ltd-latest-bent-leaf.zip");
    const after = await driftFromPage(page);

    const added = after.filter((entry) => !before.has(`${entry.state} ${entry.id}`));
    expect(added.map((entry) => `${entry.state} ${entry.id}`).sort()).toEqual(HUB_MARKS_FOR_O1.map((id) => `drift ${id}`));
    expect(new Set(added.map((entry) => entry.leaf))).toEqual(
      new Set([`Sales.xlsx!${LEAF_ONLY_THE_HUB_READS.sheet}!${LEAF_ONLY_THE_HUB_READS.cell}`]),
    );
    // The mark reads the leaf's own figure against the engine's, not the
    // hub's cache of it.
    expect(added.map((entry) => entry.asRead)).toEqual([999999, 999999]);
    expect(after.length - before.size).toBe(added.length);

    // Neither hub cell is rendered on a view yet, so the two marks stay in
    // the layer: what a rendered mark looks like is the forms spec's own
    // case (books-ltd-forms.browser.test.js, the computation's margin).
    const visible = await page.evaluate(() => document.querySelectorAll(".pencil-correction").length);
    expect(visible).toBe(0);
  });

  test("a corrupted hub cache shows exactly one stale-cache mark", async ({ page }) => {
    await uploadPackage(page, await ltdLatestZipBytes(), "ltd-latest.zip");
    const before = new Set((await driftFromPage(page)).map((entry) => `${entry.state} ${entry.id}`));

    const hub = await workbookWithBentCache(HUB_FILE, "Sales.xlsx", LEAF_TWO_WORKBOOKS_READ.sheet, LEAF_TWO_WORKBOOKS_READ.cell);
    await uploadPackage(page, await ltdLatestZipBytes({ [HUB_FILE]: hub }), "ltd-latest-stale-hub.zip");

    const afterHub = (await driftFromPage(page)).filter((entry) => !before.has(`${entry.state} ${entry.id}`));
    expect(afterHub.map((entry) => `${entry.state} ${entry.id}`)).toEqual(["stale Financialaccounts.xlsx!TrialBalance!F33"]);
    expect(afterHub[0].leaf).toBe(`Sales.xlsx!${LEAF_TWO_WORKBOOKS_READ.sheet}!${LEAF_TWO_WORKBOOKS_READ.cell}`);

    // Vatreturns caches the same leaf cell. A layer reading the hub alone
    // would call this package clean.
    const vat = await workbookWithBentCache("Vatreturns.xlsx", "Sales.xlsx", LEAF_TWO_WORKBOOKS_READ.sheet, LEAF_TWO_WORKBOOKS_READ.cell);
    await uploadPackage(page, await ltdLatestZipBytes({ "Vatreturns.xlsx": vat }), "ltd-latest-stale-vat.zip");

    const afterVat = (await driftFromPage(page)).filter((entry) => !before.has(`${entry.state} ${entry.id}`));
    expect(afterVat.map((entry) => `${entry.state} ${entry.id}`)).toEqual(["stale Vatreturns.xlsx!Vatinterface!F6"]);
    expect(afterVat[0].file).toBe("Vatreturns.xlsx");
  });
});
