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
import { s1, s2, s2ForPackage, s3, s3YearEnd, canonical, parseFigure, SCENARIOS } from "./r-sources.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const DECLARED = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app/data/render-unrepresentable/bst.json"), "utf-8"));
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
    const s3Map = s3();
    // bst-latest was built for its own year-end, not the master book's own
    // 2025-26 year, so a year-dependent Admin figure (the writing-down
    // allowance rate among them) only agrees when S2 is asked for that same
    // year -- s2ForPackage takes the year-end S3 actually reported under.
    const s2Map = s2ForPackage(basic.bookDir, s3YearEnd(), "basic-s3-year");

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

    console.log(`A3: ${compared} keys compared between S3 and S2`);
    console.log(`A3: ${onlyS2.length} keys in S2 only (all check/), ${onlyS3.length} keys in S3 only`);
    if (mismatches.length) {
      console.log(`A3: ${mismatches.length} value mismatch(es)`);
    }

    expect(onlyS2NotCheck, `S2-only keys that are not check/ verdicts:\n${onlyS2NotCheck.join("\n")}`).toEqual([]);
    expect(onlyS3, `S3-only keys:\n${onlyS3.join("\n")}`).toEqual([]);
    expect(mismatches, `mismatches:\n${mismatches.map((m) => `${m.key}: S3=${m.excelValue} S2=${m.jsValue}`).join("\n")}`).toEqual([]);
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

    const drift = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.drift);
    expect(drift).toEqual([]);
  });

  test("a hand-corrupted cell shows exactly that cell's drift, as one pencil correction", async ({ page }) => {
    const corrupted = await corruptedCachedValue(FRESH_PACKAGE_PATH, "Profit & Loss Acc", "C15", "999999");
    await uploadFile(page, corrupted, "corrupted-motor-expenses.xlsx");
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    const drift = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.drift.map((d) => d.id));
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

    const drift = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.drift.map((d) => d.id));
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

// ── A9: the SA103S form prints the form ──────────────────────────────────
// Mirrors books-se-equivalence.browser.test.js's own A9: every box in
// app/data/hmrc/form-layouts/bst.json's declared order, keyed to the cell
// it names where S2 carries one, and empty otherwise -- the same box-list
// SE's A9 walks, adapted to bst.json's single-workbook shape (a bare cell,
// no file prefix) and its two derived rule kinds ("pl:" and "sum:").

const SA103S_LAYOUT = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app/data/hmrc/form-layouts/bst.json"), "utf-8"));

// The four boxes bst-forms.js blanks together with box 11's own cell
// (D46) below the sheet's £30,000 turnover gate; box 20's own derived rule
// carries no such gate.
const GATED_BOXES = new Set(["16", "17", "18", "19"]);

// A form row's own three facts: the box number on its chip, whether the
// amount box carries a report key, and what it prints.
async function sa103sRows(page) {
  await page.locator('.tab-btn[data-view="sa103s"]').click();
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

function plValue(s2Map, cell) {
  const entry = s2Map.get(`cell/Profit & Loss Acc!${cell}`);
  return entry ? Number(entry.value) : 0;
}

// The value a "pl:" or "sum:" derived rule prints, read the same way
// bst-forms.js's own resolveDerived reads it.
function derivedValue(rule, s2Map) {
  if (rule.startsWith("pl:")) return plValue(s2Map, rule.slice(3));
  if (rule.startsWith("sum:")) {
    return rule
      .slice(4)
      .split(",")
      .reduce((sum, cell) => sum + plValue(s2Map, cell), 0);
  }
  throw new Error(`bst.json: unknown derived rule "${rule}"`);
}

function amountAsNumber(text) {
  return text === "" ? null : Number(String(text).replace(/,/g, ""));
}

// rkFor() (shell.js) joins a cell key to a CELL_MAP-derived section key with
// " || "; a box's own data-r-key carries both, so a check against the bare
// cell key reads only the first half.
function cellKeyOf(rKey) {
  return rKey === null ? null : rKey.split(" || ")[0];
}

test.describe("DIYA-GL books page — the SA103S form prints the form (A9)", () => {
  test("SA103S prints the 2026 short-return boxes in order, each keyed to its cell where the sheet has one", async ({ page }) => {
    const basic = SCENARIOS.find((example) => example.scenario === "bst-scenario-basic");
    const s2Map = s2(basic.bookDir, basic.scenario);
    const sheet = SA103S_LAYOUT.forms.sa103s.sheet;
    const boxes = SA103S_LAYOUT.forms.sa103s.sections.flatMap((section) => section.boxes);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: basic.button }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    const rows = await sa103sRows(page);
    expect(rows.map((row) => row.box)).toEqual(boxes.map((box) => box.box));

    // The fixture's turnover is above the sheet's £30,000 gate, so every
    // gated box prints; a fixture that fell below it would need the gate
    // exercised the other way, which is bst-forms.js's own unit-level cost.
    const expensesShown = s2Map.has(`cell/${sheet}!D46`);
    expect(expensesShown, "the fixture's turnover is above the sheet's gate, so boxes 16 to 19 print").toBe(true);

    const problems = [];
    rows.forEach((row, i) => {
      const box = boxes[i];
      if (!row.hasAmountBox) {
        problems.push(`box ${box.box} has no amount box`);
        return;
      }
      if (box.cell) {
        const key = `cell/${sheet}!${box.cell}`;
        const entry = s2Map.get(key);
        if (entry) {
          if (cellKeyOf(row.rKey) !== key) problems.push(`box ${box.box} carries "${row.rKey}", expected cell key "${key}"`);
          if (amountAsNumber(row.amount) !== Math.round(Number(entry.value))) {
            problems.push(`box ${box.box} prints "${row.amount}", expected ${Math.round(Number(entry.value))}`);
          }
        } else {
          if (row.rKey !== null) problems.push(`box ${box.box} names a cell R carries nothing for, yet carries "${row.rKey}"`);
          if (row.amount !== "") problems.push(`box ${box.box} names a cell R carries nothing for, yet prints "${row.amount}"`);
        }
        return;
      }
      if (box.derived) {
        const gated = GATED_BOXES.has(box.box) && !expensesShown;
        if (gated) {
          if (row.amount !== "") problems.push(`box ${box.box} is gated below turnover, yet prints "${row.amount}"`);
          return;
        }
        const expected = Math.round(derivedValue(box.derived, s2Map));
        if (amountAsNumber(row.amount) !== expected) problems.push(`box ${box.box} prints "${row.amount}", expected ${expected}`);
        // "pl:" keys its own cell; "sum:" carries no top-level key, only its parts do.
        if (box.derived.startsWith("pl:")) {
          const key = `cell/Profit & Loss Acc!${box.derived.slice(3)}`;
          if (cellKeyOf(row.rKey) !== key) problems.push(`box ${box.box} carries "${row.rKey}", expected cell key "${key}"`);
        } else if (row.rKey !== null) {
          problems.push(`box ${box.box} is a "sum:" total, expected no top-level key, carries "${row.rKey}"`);
        }
        return;
      }
      // Neither cell nor derived: the paper form's own "leave it blank".
      if (row.rKey !== null) problems.push(`box ${box.box} carries no cell or rule, yet carries "${row.rKey}"`);
      if (row.amount !== "") problems.push(`box ${box.box} carries no cell or rule, yet prints "${row.amount}"`);
    });

    expect(problems, problems.join("\n")).toEqual([]);
  });
});
