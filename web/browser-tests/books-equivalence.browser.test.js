// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-equivalence.browser.test.js
//
// A3, A4, A6 and A7 from PLAN_DIYA_GL_BST_CLI_MCP_WEB.md's test approach:
// does the browser show the reader exactly what the reconciliation proved.
// r-sources.js supplies S1 (a fixture's own totals), S2 (the JS engine over
// a book's diya-gl data) and S3 (the saved bst-latest package's cached
// cells); this file joins each against the page's own rendered figures and
// drift layer.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { s1, s2, s3, canonical, parseFigure, SCENARIOS } from "./r-sources.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const DECLARED = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app/data/render-unrepresentable.json"), "utf-8"));
const FRESH_PACKAGE_PATH = path.join(process.cwd(), "examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx");

let closeServer;
let baseUrl;

test.beforeAll(async () => {
  const server = await startStaticServer(publicDir);
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer();
});

function bstUrl() {
  return `${baseUrl}/books/bst.html`;
}

// ── The page sweep: every data-r-key on every view, both drill levels ──────
// Mirrors books-render-coverage.browser.test.js's own sweep, but keeps each
// element's class alongside its text -- A4 reads a check/ key's verdict off
// the class, not the text, since a check-item prints its figures in prose.

const VIEWS = ["year", "profit-loss", "stock", "debtors-creditors", "fixed-assets", "income-tax", "sa103s", "business-details", "admin"];

async function collectRenderedFigures(page, running) {
  const found = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-r-key]")).map((el) => ({
      raw: el.getAttribute("data-r-key"),
      text: el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ? el.value : el.textContent,
      className: el.className,
    }));
  });
  for (const { raw, text, className } of found) {
    for (const key of raw.split(" || ")) running.set(key, { text, className });
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

async function sweepPage(page, exampleButton) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: exampleButton }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

  const running = new Map();
  for (const view of VIEWS) {
    await page.locator(`.tab-btn[data-view="${view}"]`).click();
    await collectRenderedFigures(page, running);
    if (view === "year") await openEveryMonth(page, running);
  }
  return running;
}

// ── Workbook corruption, for A7's breakability proof ────────────────────────
// The same mechanics as books-bst.browser.test.js's own corruptedCachedValue,
// on a different cell (Profit & Loss Acc!C15, Motor Expenses) so the two
// specs never race the same fixture edit. A sheet name carrying "&" appears
// XML-escaped in workbook.xml, so the lookup escapes before it matches.

function xmlEscapeAttr(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sheetPathByName(zip, sheetName) {
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const escaped = xmlEscapeAttr(sheetName);
  const tag = [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)].find((m) => m[1].includes(`name="${escaped}"`));
  if (!tag) throw new Error(`sheet "${sheetName}" not found in the fixture workbook`);
  const rid = /r:id="([^"]+)"/.exec(tag[1])[1];
  const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(relsXml)[1];
  return `xl/${target}`;
}

async function corruptedCachedValue(sourcePath, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
  const sheetPath = await sheetPathByName(zip, sheetName);
  const xml = await zip.file(sheetPath).async("string");
  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"[^>]*>)([\\s\\S]*?)(</c>)`);
  if (!cellPattern.test(xml)) throw new Error(`cell ${sheetName}!${cellRef} not found or is self-closing`);
  const patched = xml.replace(
    cellPattern,
    (full, open, inner, close) => open + inner.replace(/<v>[\s\S]*?<\/v>/, `<v>${newValue}</v>`) + close,
  );
  zip.file(sheetPath, patched);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function uploadFile(page, buffer, name) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await page.locator("#file-picker").setInputFiles({
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
}

// ── A3: the sheet agrees ─────────────────────────────────────────────────

test.describe("DIYA-GL books page — the sheet agrees (A3)", () => {
  test("S3 (bst-latest, saved) equals S2 (the JS engine) for every shared key", () => {
    const basic = SCENARIOS.find((example) => example.scenario === "bst-scenario-basic");
    const s2Map = s2(basic.bookDir, "basic");
    const s3Map = s3();

    const onlyS2 = [...s2Map.keys()].filter((key) => !s3Map.has(key));
    const onlyS3 = [...s3Map.keys()].filter((key) => !s2Map.has(key));

    // S3 is read straight from the saved package's own cells, with no
    // scenario passed alongside --source-dir, so it never publishes a
    // compliance verdict of its own -- every S2-only key is a check/ one.
    const onlyS2NotCheck = onlyS2.filter((key) => !key.startsWith("check/"));

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

    // examples/bst-latest is a saved package the repository keeps as a
    // fixed reference, refreshed on its own schedule rather than on every
    // fixture edit -- it can briefly lag the current fixture's text and
    // tax-year data. These two cells are that lag's own gauge: a new,
    // unexplained mismatch fails by name; these do not widen silently.
    const KNOWN_STALE_KEYS = new Set([
      "cell/Admin!G5",
      "section/admin-generator-injected/writing-down-allowance-rate",
      "cell/Business Details!C7",
      "section/business-details/description",
    ]);
    const unexplained = mismatches.filter((mismatch) => !KNOWN_STALE_KEYS.has(mismatch.key));

    console.log(`A3: ${compared} keys compared between S3 and S2`);
    console.log(`A3: ${onlyS2.length} keys in S2 only (all check/), ${onlyS3.length} keys in S3 only`);
    if (mismatches.length) {
      console.log(`A3: ${mismatches.length} value mismatch(es), ${unexplained.length} unexplained`);
    }

    expect(onlyS2NotCheck, `S2-only keys that are not check/ verdicts:\n${onlyS2NotCheck.join("\n")}`).toEqual([]);
    expect(onlyS3, `S3-only keys:\n${onlyS3.join("\n")}`).toEqual([]);
    expect(
      unexplained,
      `mismatches not on the known-stale list:\n${unexplained.map((m) => `${m.key}: S3=${m.excelValue} S2=${m.jsValue}`).join("\n")}`,
    ).toEqual([]);
    expect(compared).toBeGreaterThan(0);
  });
});

// ── A4: the screen agrees ────────────────────────────────────────────────

test.describe("DIYA-GL books page — the screen agrees (A4)", () => {
  for (const example of SCENARIOS) {
    test(`${example.scenario}: every rendered figure matches S2`, async ({ page }) => {
      const s2Map = s2(example.bookDir, example.scenario);
      const rendered = await sweepPage(page, example.button);

      let compared = 0;
      const mismatches = [];
      for (const [key, { text, className }] of rendered) {
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

        if (!["money", "rate", "count"].includes(s2Entry.unit)) continue; // text/date/identifier: A5 covers presence, not value.
        const parsed = parseFigure(text);
        const renderedCanonical = canonical(parsed.value, s2Entry.unit);
        const expectedCanonical = canonical(s2Entry.value, s2Entry.unit);
        if (renderedCanonical !== expectedCanonical) {
          mismatches.push(`${key}: rendered "${text}" -> ${renderedCanonical}, S2 says ${expectedCanonical}`);
        }
      }

      const declaredInS2 = [...s2Map.keys()].filter((key) => key in DECLARED);
      const expectedMinimum = s2Map.size - declaredInS2.length;
      console.log(`A4 (${example.scenario}): ${compared} figures compared, S2 requires at least ${expectedMinimum}`);

      expect(mismatches, `A4 mismatches:\n${mismatches.join("\n")}`).toEqual([]);
      expect(compared).toBeGreaterThanOrEqual(expectedMinimum);
    });
  }
});

// ── A6: the fixture holds ────────────────────────────────────────────────

// Every [expected] total the reconciliation test (bst-precision-code-
// reconciliation.test.js) and CELL_MAP (app/products/bst.js) both anchor to
// one workbook cell directly. total_mileage is not here: it feeds Motor
// Expenses through a claim calculation (checkCompliance's cashMotor +
// mileageClaim check), not a bare cell equality, so it has no single S2 key
// to compare against.
const EXPECTED_KEY_MAP = {
  total_sales: "cell/Profit & Loss Acc!C4",
  gross_profit: "cell/Profit & Loss Acc!C9",
  net_profit: "cell/Profit & Loss Acc!C24",
  total_premises: "cell/Profit & Loss Acc!C12",
  total_gen_admin: "cell/Profit & Loss Acc!C14",
  total_legal: "cell/Profit & Loss Acc!C18",
  fixed_asset_cost: "cell/Fixed Assets!E1",
};

test.describe("DIYA-GL books page — the fixture holds (A6)", () => {
  for (const example of SCENARIOS) {
    test(`${example.scenario}: S1's totals equal S2's cells`, () => {
      const expected = s1(example.scenario);
      const s2Map = s2(example.bookDir, example.scenario);

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
      expect(compared).toBeGreaterThan(0);
    });
  }
});

// ── A7: no drift on a true upload ────────────────────────────────────────

test.describe("DIYA-GL books page — no drift on a true upload (A7)", () => {
  test("a fresh bst-latest upload carries no drift", async ({ page }) => {
    await uploadFile(page, fs.readFileSync(FRESH_PACKAGE_PATH), "GB_Accounts_Basic_Sole_Trader.xlsx");
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    const drift = await page.evaluate(() => window.DIYA_BST_SNAPSHOT.drift);
    expect(drift).toEqual([]);
  });

  test("a hand-corrupted cell shows exactly that cell's drift, as one pencil correction", async ({ page }) => {
    const corrupted = await corruptedCachedValue(FRESH_PACKAGE_PATH, "Profit & Loss Acc", "C15", "999999");
    await uploadFile(page, corrupted, "corrupted-motor-expenses.xlsx");
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    const drift = await page.evaluate(() => window.DIYA_BST_SNAPSHOT.drift.map((d) => d.id));
    expect(drift).toEqual(["Profit & Loss Acc!C15"]);

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator(".pencil-correction")).toHaveCount(1);
    await expect(page.locator('.pencil-correction .computed-value[data-r-key*="Profit & Loss Acc!C15"]')).toHaveCount(1);
  });

  // The mark is not wired to a handful of named cells: any figure whose own
  // cell drifts carries it, on whatever view renders that figure. This one
  // is on a view that carried no mark before.
  test("a corrupted ledger total is marked on the Debtors & Creditors view", async ({ page }) => {
    const corrupted = await corruptedCachedValue(FRESH_PACKAGE_PATH, "Debtors & Creditors", "C29", "123456");
    await uploadFile(page, corrupted, "corrupted-debtors-total.xlsx");
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    const drift = await page.evaluate(() => window.DIYA_BST_SNAPSHOT.drift.map((d) => d.id));
    expect(drift).toEqual(["Debtors & Creditors!C29"]);

    await page.locator('.tab-btn[data-view="debtors-creditors"]').click();
    await expect(page.locator(".pencil-correction")).toHaveCount(1);
    await expect(page.locator('.pencil-correction .computed-value[data-r-key*="Debtors & Creditors!C29"]')).toHaveCount(1);
    await expect(page.locator(".pencil-correction .as-read")).toContainText("123,456");

    // Nothing else picked one up: the computed side never reads that cell.
    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator(".pencil-correction")).toHaveCount(0);
  });
});
