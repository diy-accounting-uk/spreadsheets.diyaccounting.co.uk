// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-se-equivalence.browser.test.js
//
// The A-series for the Self Employed page (books/se.html): does the browser
// show the reader exactly what the reconciliation proved, and do the files
// it hands back carry the same figures.
//
// r-sources.js supplies S1 (a fixture's own totals), S2 (the JS engine over
// a book's diya-gl data) and S3 (the saved se-latest package's cached
// cells); this file joins each against the page's own rendered figures, its
// diya-gl zip and its package zip.
//
// Only the advanced book is served as an example the page has a button for.
// The two BrickWork books reach the page as a diya-gl zip built here from
// the same directory, which is the same door the page's own diya-gl
// download comes back through.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { s1, s2ForPackage, s3Se, s3SeYearEnd, canonical, parseFigure, SCENARIOS_SE } from "./r-sources.js";
import { loadDiyaGlData, diyaGlToScenario } from "../../app/lib/diya-gl-loader.js";
import { calculateSeCells } from "../../app/lib/calculators/se.js";
import { savePackageZip, taxYearFileName } from "../../app/lib/product-workbook.js";
import { linkCacheValues, externalLinks, HUB_FILE } from "../../app/lib/link-caches.js";
import { canonicalValue } from "../../app/lib/report-serializer.js";
import { parse as parseTOML } from "smol-toml";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const ASSETS_EXAMPLE_DIR = path.join(PUBLIC_DIR, "books/assets/examples/precision-code-ltd/advanced");
const TARGET_DIR = path.join(ROOT, "target", "books-se-equivalence");
const LAYOUT = JSON.parse(fs.readFileSync(path.join(ROOT, "app/data/hmrc/form-layouts/se.json"), "utf-8"));

const FEATURED = SCENARIOS_SE[0];

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

function seUrl(search) {
  return `${baseUrl}/books/se.html${search || ""}`;
}

// ── S2 for a Self Employed book, on the tax data the page itself reads ────
// The page loads the tax year file taxYearFileName names for the book's own
// period; report.js's bare --data path instead extracts what the book.toml's
// [tax] section happens to carry, which report.js's own log calls the
// imprecise route ("use --years for precise rates"). So every comparison
// here asks report.js for the same year file, which is what s2ForPackage
// takes a year-end for.

function periodEndOf(bookDir) {
  const { book } = loadDiyaGlData(path.join(ROOT, bookDir));
  return new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);
}

function seReport(example) {
  return s2ForPackage(example.bookDir, periodEndOf(example.bookDir), example.scenario, "se");
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

function excelSerialAsDate(serial) {
  return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY).toISOString().slice(0, 10);
}

// What a figure R holds should print as: whole pounds inside a form box, the
// penny the double rounds to everywhere else, and the raw value for a rate
// or a count.
function expectedForUnit(entry, wholePounds) {
  if (entry.unit !== "money") return entry.value;
  return wholePounds ? Math.round(Number(entry.value)) : Number(entry.value).toFixed(2);
}

// ── Getting each of the three books onto the page ─────────────────────────

async function diyaGlZipOf(bookDir) {
  const zip = new JSZip();
  zip.file("book.toml", fs.readFileSync(path.join(ROOT, bookDir, "book.toml")));
  zip.file("lines.jsonl", fs.readFileSync(path.join(ROOT, bookDir, "lines.jsonl")));
  zip.file("report.json", "{}\n");
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
  if (example.example) {
    await page.goto(seUrl(`?example=${example.example}`), { waitUntil: "domcontentloaded" });
  } else {
    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, await diyaGlZipOf(example.bookDir), `${example.scenario}-diya-gl.zip`);
  }
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

// ── The page sweep: every data-r-key on every view, both drill levels ─────
// Keeps each element's class alongside its text, so A4 reads a check/ key's
// verdict off the class rather than the prose a check item prints, and keeps
// each view's own key set alongside the running one, so a figure two views
// both print still counts for both.

async function collectRenderedFigures(page, view, running, keysByView) {
  const found = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-r-key]")).map((el) => ({
      raw: el.getAttribute("data-r-key"),
      text: el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ? el.value : el.textContent,
      className: el.className,
      // Every SE form box prints whole pounds (se-forms.js formats each one
      // through fmtBoxWhole), so a figure inside one compares at the
      // precision the box itself declares.
      wholePounds: el.classList.contains("form-amount-box"),
    }));
  });
  for (const { raw, text, className, wholePounds } of found) {
    for (const key of raw.split(" || ")) {
      running.set(key, { text, className, wholePounds, view });
      keysByView.get(view).add(key);
    }
  }
}

async function openEveryMonth(page, running, keysByView) {
  const monthCount = await page.locator(".year-row").count();
  for (let i = 0; i < monthCount; i++) {
    await page.locator(".year-row").nth(i).click();
    const entriesToggle = page.locator("#entries-toggle");
    if (await entriesToggle.count()) await entriesToggle.click();
    await collectRenderedFigures(page, "year", running, keysByView);
  }
}

async function sweepPage(page, example) {
  await openBook(page, example);
  const viewIds = await page.evaluate(() => window.DiyaGlBooksPage.manifest.views.map((view) => view.id));

  const running = new Map();
  const keysByView = new Map(viewIds.map((view) => [view, new Set()]));
  for (const view of viewIds) {
    await page.locator(`.tab-btn[data-view="${view}"]`).click();
    await expect(page.locator(`.tab-btn[data-view="${view}"]`)).toHaveAttribute("aria-selected", "true");
    await collectRenderedFigures(page, view, running, keysByView);
    if (view === "year") await openEveryMonth(page, running, keysByView);
  }
  return { rendered: running, viewIds, keysByView };
}

// ── A1, A2: the diya-gl download is the book, byte for byte ───────────────

test.describe("DIYA-GL books page — the Self Employed diya-gl download (A1, A2)", () => {
  test("A1: the diya-gl zip's book.toml and lines.jsonl equal the served example, byte for byte", async ({ page }) => {
    await openBook(page, FEATURED);

    const { bytes } = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).sort()).toEqual(["book.toml", "bookchecks.json", "lines.jsonl", "report.json"]);

    expect(await zip.file("book.toml").async("string")).toBe(fs.readFileSync(path.join(ASSETS_EXAMPLE_DIR, "book.toml"), "utf-8"));
    expect(await zip.file("lines.jsonl").async("string")).toBe(fs.readFileSync(path.join(ASSETS_EXAMPLE_DIR, "lines.jsonl"), "utf-8"));
  });

  test("A2: the diya-gl zip's report.json equals report.js --package se --data's, byte for byte", async ({ page }) => {
    await openBook(page, FEATURED);

    const { bytes } = await triggerSaveDownload(page, "Download books as diya-gl (.zip)");
    const zip = await JSZip.loadAsync(bytes);
    const pageReportText = await zip.file("report.json").async("string");

    const yearEnd = periodEndOf(FEATURED.bookDir);
    const outputDir = path.join(TARGET_DIR, "r-advanced");
    execFileSync(
      process.execPath,
      [
        "app/bin/report.js",
        "--package",
        "se",
        "--data",
        FEATURED.bookDir,
        "--years",
        taxYearFileName(new Date(yearEnd), "se"),
        "--year-end",
        yearEnd,
        "--output-dir",
        outputDir,
      ],
      { cwd: ROOT, stdio: "pipe" },
    );

    expect(pageReportText).toBe(fs.readFileSync(path.join(outputDir, "report.json"), "utf-8"));
  });
});

// ── A3: the sheet agrees ─────────────────────────────────────────────────

test.describe("DIYA-GL books page — the sheet agrees (A3)", () => {
  // Two key families S3 can never carry, because --source-dir --mode saved
  // reads the workbooks' own cached cells with no scenario alongside them: a
  // compliance verdict, and the journal-category VAT netting, which
  // report-generator.js builds from productMod.categoryNetting(results,
  // scenario) -- the journal lines, which a saved read has none of.
  const SAVED_MODE_CANNOT_CARRY = ["check/", "section/journal-category-vat-netting/"];

  test("S3 (se-latest, saved) equals S2 (the JS engine) for every shared key", () => {
    const s3Map = s3Se();
    // se-latest was built for its own year-end, not the master book's own
    // 2025-26 year, so a year-dependent Admin figure only agrees when S2 is
    // asked for that same year -- s2ForPackage takes the year-end S3
    // actually reported under.
    const s2Map = s2ForPackage(FEATURED.bookDir, s3SeYearEnd(), "se-advanced-s3-year", "se");

    const onlyS2 = [...s2Map.keys()].filter((key) => !s3Map.has(key));
    const onlyS3 = [...s3Map.keys()].filter((key) => !s2Map.has(key));
    const onlyS2Unexplained = onlyS2.filter((key) => !SAVED_MODE_CANNOT_CARRY.some((prefix) => key.startsWith(prefix)));

    let compared = 0;
    const mismatches = [];
    for (const [key, s3Entry] of s3Map) {
      const s2Entry = s2Map.get(key);
      if (!s2Entry) continue;
      compared++;
      const unit = s3Entry.unit ?? s2Entry.unit;
      const excelValue = canonical(s3Entry.value, unit);
      const jsValue = canonical(s2Entry.value, unit);
      if (excelValue !== jsValue) mismatches.push({ key, excelValue, jsValue });
    }

    console.log(`A3: ${compared} keys compared between S3 and S2 at year-end ${s3SeYearEnd()}`);
    console.log(`A3: ${onlyS2.length} keys in S2 only, ${onlyS3.length} keys in S3 only`);
    if (mismatches.length) console.log(`A3: ${mismatches.length} value mismatch(es)`);

    expect(onlyS2Unexplained, `S2-only keys a saved read should have carried:\n${onlyS2Unexplained.join("\n")}`).toEqual([]);
    expect(onlyS3, `S3-only keys:\n${onlyS3.join("\n")}`).toEqual([]);
    expect(mismatches, `mismatches:\n${mismatches.map((m) => `${m.key}: S3=${m.excelValue} S2=${m.jsValue}`).join("\n")}`).toEqual([]);
    expect(compared).toBeGreaterThan(0);
  });
});

// ── A4: the screen agrees ────────────────────────────────────────────────

test.describe("DIYA-GL books page — the screen agrees (A4)", () => {
  for (const example of SCENARIOS_SE) {
    test(`${example.scenario}: every rendered figure matches S2`, async ({ page }) => {
      const s2Map = seReport(example);
      const { rendered, viewIds, keysByView } = await sweepPage(page, example);

      let compared = 0;
      const mismatches = [];
      for (const [key, { text, className, wholePounds, view }] of rendered) {
        const s2Entry = s2Map.get(key);
        if (!s2Entry) continue; // A5 (books-render-coverage) proves every rendered key is one S2 carries.
        compared++;

        if (key.startsWith("check/")) {
          const classNames = String(className).split(/\s+/);
          const renderedVerdict = classNames.includes("fail") ? "fail" : classNames.includes("pass") ? "pass" : null;
          if (renderedVerdict !== s2Entry.value) {
            mismatches.push(`${key}: rendered verdict "${renderedVerdict}" (class "${className}"), S2 says "${s2Entry.value}"`);
          }
          continue;
        }

        // The PAYE remittance schedule's dates sit in the sheet as Excel day
        // serials, which R records under the money unit; the page prints the
        // day each one names, so the two meet on the date.
        const isoDate = /^\d{4}-\d{2}-\d{2}$/.exec(String(text).trim());
        if (isoDate && Number.isFinite(Number(s2Entry.value))) {
          const fromSerial = excelSerialAsDate(Number(s2Entry.value));
          if (fromSerial !== isoDate[0]) {
            mismatches.push(`${key} (${view}): rendered "${isoDate[0]}", S2's serial ${s2Entry.value} is ${fromSerial}`);
          }
          continue;
        }

        if (!["money", "rate", "count"].includes(s2Entry.unit)) continue; // text/date/identifier: A5 covers presence, not value.
        const parsed = parseFigure(text);
        // Both sides hold the same double here -- the page and report.js run
        // the one engine -- so a money figure meets R at the penny that
        // double itself rounds to. canonical()'s own working-precision step
        // is for the Excel side of A3, where the two engines' float noise
        // has to be absorbed before the penny is chosen; applied to a figure
        // sitting exactly on a half penny it can pick the penny above while
        // the browser's formatter, which only ever sees the double, prints
        // the one below.
        const expectedValue = expectedForUnit(s2Entry, wholePounds);
        const renderedCanonical = canonical(parsed.value, s2Entry.unit);
        const expectedCanonical = canonical(expectedValue, s2Entry.unit);
        if (renderedCanonical !== expectedCanonical) {
          mismatches.push(`${key} (${view}): rendered "${text}" -> ${renderedCanonical}, S2 says ${expectedCanonical}`);
        }
      }

      // Home is a navigation list, not a set of figures; every other view of
      // the manifest prints at least one figure R carries.
      const silentViews = viewIds.filter((view) => view !== "home" && ![...keysByView.get(view)].some((key) => s2Map.has(key)));
      console.log(`A4 (${example.scenario}): ${compared} figures compared across ${viewIds.length} views`);

      expect(mismatches, `A4 mismatches:\n${mismatches.join("\n")}`).toEqual([]);
      expect(silentViews, `views that rendered no figure S2 carries:\n${silentViews.join("\n")}`).toEqual([]);
      expect(compared).toBeGreaterThan(0);
    });
  }
});

// ── A6: the fixture holds ────────────────────────────────────────────────

// The [expected] totals extract-scenarios.js writes for an SE fixture that
// one Profit & Loss Account cell carries on its own. total_motor_net and
// total_mileage are not here: the advanced book's motor total is the motor
// spend net plus the mileage allowance, written to whole pounds
// (extract-scenarios.js's advanced section), so it is a claim calculation
// rounded, not a bare cell equality -- the sheet's own B25 is 6,434.25.
const EXPECTED_KEY_MAP = {
  total_sales: "cell/Financialaccounts.xlsx!Profit & Loss Account!B9",
  total_legal_net: "cell/Financialaccounts.xlsx!Profit & Loss Account!B28",
};

test.describe("DIYA-GL books page — the fixture holds (A6)", () => {
  for (const example of SCENARIOS_SE) {
    test(`${example.scenario}: S1's totals equal S2's cells`, () => {
      const expected = s1(example.scenario);
      const s2Map = seReport(example);

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
        const s2Value = canonical(entry.value, entry.unit);
        if (fixtureValue !== s2Value) mismatches.push(`${expectedKey} (${cellKey}): fixture ${fixtureValue}, S2 ${s2Value}`);
      }

      expect(mismatches, mismatches.join("\n")).toEqual([]);
      expect(compared).toBe(Object.keys(EXPECTED_KEY_MAP).length);
    });
  }
});

// ── A7: a true package upload ────────────────────────────────────────────

test.describe("DIYA-GL books page — a true package upload (A7)", () => {
  // The nine workbooks of examples/se-latest, zipped the way a customer's
  // own download ships. The page sniffs the set as Self Employed and then
  // refuses it: products/se.js's upload.validate throws, so the drift and
  // stale-cache layers a real package would light up have no way onto this
  // page yet. Asserting the refusal by name keeps that visible; when the
  // page reads a package the assertion becomes the drift set.
  const REFUSAL =
    "A Self Employed package is nine workbooks. This page reads one back from a diya-gl zip or a diya-gl JSON file; " +
    "reading the workbooks themselves is not on this page yet.";

  async function seLatestZipBytes() {
    const dir = path.join(ROOT, "examples/se-latest");
    const zip = new JSZip();
    for (const name of fs.readdirSync(dir).filter((file) => file.endsWith(".xlsx"))) {
      zip.file(name, fs.readFileSync(path.join(dir, name)));
    }
    return zip.generateAsync({ type: "nodebuffer" });
  }

  test("the se-latest package is sniffed as Self Employed and refused by name", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
    await dropFile(page, await seLatestZipBytes(), "se-latest-package.zip");

    const message = page.locator("#empty-state-message");
    await expect(message).toHaveClass(/upload-error/);
    await expect(message).toHaveText(REFUSAL);
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);
    expect(await page.evaluate(() => window.DiyaGlBooksPage.manifest.id)).toBe("se");
  });
});

// ── A8: the saved package agrees with the calculator ─────────────────────

// Every cell the SE calculator holds, keyed the way an external link
// addresses it: the hub's own sheets under the hub file name, a leaf sheet
// under its own file.
function calculatorCellsByLinkKey(bookDir) {
  const { book, lines } = loadDiyaGlData(path.join(ROOT, bookDir));
  const scenario = diyaGlToScenario(book, lines, "se");
  const taxYear = taxYearFileName(new Date(book.documentInfo.periodCoveredEnd), "se");
  const taxData = parseTOML(fs.readFileSync(path.join(ROOT, "app/data", `${taxYear}.toml`), "utf-8"));
  const cells = calculateSeCells(book, lines, taxData, scenario);
  const keys = new Map();
  for (const [sheetKey, sheet] of Object.entries(cells)) {
    const prefix = sheetKey.includes("!") ? sheetKey : `${HUB_FILE}!${sheetKey}`;
    for (const [cell, value] of Object.entries(sheet)) keys.set(`${prefix}!${cell}`, value);
  }
  return { book, lines, keys };
}

async function packageWorkbooks(zipBytes) {
  const zip = await JSZip.loadAsync(zipBytes);
  const workbooks = new Map();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !name.endsWith(".xlsx")) continue;
    workbooks.set(path.basename(name), await JSZip.loadAsync(await entry.async("uint8array")));
  }
  return workbooks;
}

// Every cached link value in a set of workbooks, against the calculator's
// own figure for the cell each one addresses.
async function cacheDisagreements(workbooks, keys) {
  let compared = 0;
  const disagreements = [];
  for (const [name, workbook] of workbooks) {
    for (const [key, cached] of await linkCacheValues(workbook)) {
      if (!keys.has(key)) continue;
      compared++;
      if (canonicalValue(cached) !== canonicalValue(keys.get(key))) {
        disagreements.push(`${name} caches ${key} as ${cached}, the calculator holds ${keys.get(key)}`);
      }
    }
  }
  return { compared, disagreements };
}

test.describe("DIYA-GL books page — the saved package agrees with the calculator (A8)", () => {
  test("the package zip the page downloads is Node's savePackageZip, byte for byte", async ({ page }) => {
    await openBook(page, FEATURED);
    const { download, bytes } = await triggerSaveDownload(page, "Download package (.zip)");

    const { book, lines } = calculatorCellsByLinkKey(FEATURED.bookDir);
    const node = await savePackageZip(book, lines);

    expect(download.suggestedFilename()).toBe(node.filename);
    expect(Buffer.compare(bytes, Buffer.from(node.zip))).toBe(0);
  });

  test("every link cache in the nine downloaded workbooks holds the calculator's value", async ({ page }) => {
    await openBook(page, FEATURED);
    const { bytes } = await triggerSaveDownload(page, "Download package (.zip)");

    const { keys } = calculatorCellsByLinkKey(FEATURED.bookDir);
    const workbooks = await packageWorkbooks(bytes);
    expect(workbooks.size).toBe(9);

    const { compared, disagreements } = await cacheDisagreements(workbooks, keys);

    console.log(`A8: ${compared} link cache cells compared against the calculator`);
    expect(disagreements, disagreements.join("\n")).toEqual([]);
    expect(compared).toBeGreaterThanOrEqual(539);
  });

  test("one cached value bent in the downloaded hub is the only cell that then disagrees", async ({ page }) => {
    await openBook(page, FEATURED);
    const { bytes } = await triggerSaveDownload(page, "Download package (.zip)");

    const { keys } = calculatorCellsByLinkKey(FEATURED.bookDir);
    const workbooks = await packageWorkbooks(bytes);
    const hub = workbooks.get(HUB_FILE);

    const salesLink = (await externalLinks(hub)).find((link) => link.targetFile === "Sales.xlsx");
    const aprilId = salesLink.sheetNames.indexOf("Apr");
    const xml = await hub.file(salesLink.path).async("string");
    const block = new RegExp(`<sheetData\\s+sheetId="${aprilId}"[^>]*>[\\s\\S]*?</sheetData>`).exec(xml)[0];
    const cell = /<cell r="P1"><v>([^<]*)<\/v><\/cell>/.exec(block);
    expect(cell, "the hub caches Sales.xlsx!Apr!P1").not.toBeNull();
    hub.file(salesLink.path, xml.replace(block, block.replace(cell[0], `<cell r="P1"><v>${Number(cell[1]) + 1000}</v></cell>`)));

    const { disagreements } = await cacheDisagreements(workbooks, keys);
    expect(disagreements.map((line) => line.split(" caches ")[1].split(" as ")[0])).toEqual(["Sales.xlsx!Apr!P1"]);
  });
});

// ── A9: the forms print the form ─────────────────────────────────────────

// A form row's own three facts: the box number on its chip, whether the
// amount box carries a report key, and what it prints.
async function formRows(page, viewId) {
  await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
  await expect(page.locator("#view-root .form-render").first()).toBeAttached({ timeout: 30_000 });
  return page.locator("#view-root .form-row").evaluateAll((rows) =>
    rows.map((row) => {
      const chip = row.querySelector(".box-chip");
      const box = row.querySelector(".form-amount-box");
      return {
        box: chip ? chip.textContent : null,
        hasAmountBox: !!box,
        rKey: box ? box.getAttribute("data-r-key") : null,
        amount: box ? box.textContent.trim() : null,
      };
    }),
  );
}

// Which boxes a section prints: all of them, unless the section collapses
// below a turnover threshold, in which case only its own total.
function expectedBoxes(form, s2Map) {
  const value = (ref) => {
    const entry = s2Map.get(`cell/${ref}`);
    return entry === undefined ? undefined : Number(entry.value);
  };
  const boxes = [];
  for (const section of form.sections) {
    const turnover = section.collapseTurnover === undefined ? undefined : value(section.collapseTurnover);
    const threshold = section.collapseBelow === undefined ? undefined : value(section.collapseBelow);
    const collapsed = typeof turnover === "number" && typeof threshold === "number" && turnover < threshold;
    for (const box of section.boxes) {
      if (collapsed && !box.total) continue;
      boxes.push(box);
    }
  }
  return boxes;
}

// A box prints the cell it names; a box with no cell, and a box whose cell
// R carries no entry for (report-serializer.js drops a blank), prints
// present and empty with no key of its own -- empty but for the standing
// note a computation line may carry in place of a figure.
function checkBoxes(rows, boxes, s2Map, problems) {
  expect(rows.map((row) => row.box)).toEqual(boxes.map((box) => box.box));
  rows.forEach((row, i) => {
    const box = boxes[i];
    if (!row.hasAmountBox) problems.push(`box ${box.box} has no amount box`);
    if (box.rule) return; // A rule box computes from its siblings and carries no cell of its own.
    const key = box.cell ? `cell/${box.cell}` : null;
    if (key && s2Map.has(key)) {
      if (row.rKey !== key) problems.push(`box ${box.box} carries "${row.rKey}", expected "${key}"`);
    } else {
      const empty = box.text || "";
      if (row.rKey !== null) problems.push(`box ${box.box} names no cell R carries, yet carries "${row.rKey}"`);
      if (row.amount !== empty) problems.push(`box ${box.box} names no cell R carries, yet prints "${row.amount}"`);
    }
  });
}

test.describe("DIYA-GL books page — the forms print the form (A9)", () => {
  test("SA103S prints the 2026 short-return boxes, each keyed to its cell", async ({ page }) => {
    const s2Map = seReport(FEATURED);
    await openBook(page, FEATURED);

    const expenses = LAYOUT.forms.sa103s.sections.find((section) => section.collapseBelow);
    const turnover = Number(s2Map.get(`cell/${expenses.collapseTurnover}`).value);
    const threshold = Number(s2Map.get(`cell/${expenses.collapseBelow}`).value);
    expect(turnover, "the advanced book's turnover is above the threshold, so every expense box prints").toBeGreaterThanOrEqual(threshold);

    const problems = [];
    checkBoxes(await formRows(page, "sa103s"), expectedBoxes(LAYOUT.forms.sa103s, s2Map), s2Map, problems);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("SA103F prints the 2026 full-return boxes, each keyed to its cell", async ({ page }) => {
    const s2Map = seReport(FEATURED);
    await openBook(page, FEATURED);

    const problems = [];
    checkBoxes(await formRows(page, "sa103f"), expectedBoxes(LAYOUT.forms.sa103f, s2Map), s2Map, problems);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("the VAT return prints all nine boxes for each of the five quarters", async ({ page }) => {
    const s2Map = seReport(FEATURED);
    await openBook(page, FEATURED);

    const vat = LAYOUT.forms.vat;
    const boxes = [];
    for (const quarter of vat.quarters) {
      for (const box of vat.boxes) {
        boxes.push({ box: box.box, cell: box.cell ? `${vat.file}!${vat.sheetPrefix}${quarter}!${box.cell}` : null });
      }
    }

    const problems = [];
    checkBoxes(await formRows(page, "vat"), boxes, s2Map, problems);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("the Income Tax computation prints the working sheet's own lines in order", async ({ page }) => {
    const s2Map = seReport(FEATURED);
    await openBook(page, FEATURED);

    // A band line renders as a rate row -- a label, its ceiling and its rate
    // -- with no box chip of its own, so the chipped rows are the rest.
    const lines = LAYOUT.forms.computation.lines.filter((line) => line.ref !== "band");
    const rows = (await formRows(page, "income-tax")).filter((row) => row.box !== null);

    const problems = [];
    checkBoxes(
      rows,
      lines.map((line) => ({ box: line.ref, cell: line.cell, text: line.text })),
      s2Map,
      problems,
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
