// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-taxi-edits.browser.test.js
//
// E1 and E2 from PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md's test approach: the four
// E1 edit cases and the E2 warning table, driven through the Taxi page.
//
// Every E1 assertion anchors in a figure the page renders (never the page's
// own internal state) and cross-checks the browser's own diya-gl-zip
// report.json against r-sources.js's applyNamedEdit, which builds R the
// same way over the same book in Node -- byte for byte agreement there is
// the only way to know the browser reached the same engine the CLI does.
// Every E2 case is driven pass -> fail -> (helper) -> pass, so each check is
// proved breakable before it is proved fixable.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { applyNamedEdit } from "./r-sources.js";
import { addSaleLine, changeLineQuantity } from "../../app/lib/diya-gl-edits.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const TARGET_DIR = path.join(ROOT, "target", "books-taxi-edits");
fs.mkdirSync(TARGET_DIR, { recursive: true });

const BASIC_DIR = "examples/basic-taxi-driver/taxi";
const SP_SIXTY_DIR = "examples/sp-sixty-driving/taxi";

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

function taxiUrl() {
  return `${baseUrl}/books/taxi.html`;
}

async function waitForLoaded(page) {
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function openBook(page, example) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(taxiUrl(), { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: example }).click();
  await waitForLoaded(page);
}

async function openMonth(page, monthKey) {
  const row = page.locator(`.year-row[data-month="${monthKey}"]`);
  if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
}

async function openWeek(page, weekStart) {
  const row = page.locator(`tr.week-row[data-week="${weekStart}"]`);
  if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
}

async function addFareViaUI(page, date, { amount, detail, miles }) {
  await page.locator(`[data-add-fare="${date}"]`).click();
  if (detail !== undefined) await page.locator('[data-draft-field="detail"]').fill(detail);
  if (miles !== undefined) await page.locator('[data-draft-field="miles"]').fill(String(miles));
  await page.locator('[data-draft-field="amount"]').fill(String(amount));
  await page.locator("[data-draft-commit]").click();
}

async function addCaptionViaUI(page, kind, weekStart, amount) {
  await page.locator(`[data-add-caption="${kind}"][data-week="${weekStart}"]`).click();
  await page.locator('[data-draft-field="amount"]').fill(String(amount));
  await page.locator("[data-draft-commit]").click();
}

async function readMoney(page, selector) {
  const text = await page.locator(selector).first().innerText();
  return Number(text.replace(/[£,\s]/g, ""));
}

async function downloadDiyaGlReport(page) {
  await page.click("#save-btn");
  const item = page.getByRole("menuitem", { name: "Download books as diya-gl (.zip)", exact: true });
  await item.waitFor({ state: "visible" });
  const [download] = await Promise.all([page.waitForEvent("download"), item.click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  return zip.file("report.json").async("string");
}

function bookCheck(page, id) {
  return page.locator(`#inspector [data-book-check="${id}"]`);
}

// ── E1a: add a fare on a day that already has one ───────────────────────────
//
// 2025-06-11 (TXN-0045, a Wednesday) is an ordinary mid-year weekday in the
// April-June quarter (VitalTax's Q1), so the day, June's month total, Q1
// and the year all move by the same amount, and nothing about the year's
// edges complicates which week or quarter it falls in.

test.describe("DIYA-GL Taxi books page — E1: add a fare on a day that has one", () => {
  test("the day, June, Q1 and the year all move by the fare, and the browser agrees with Node", async ({ page }) => {
    await openBook(page, /taxi-scenario-basic/);
    await openMonth(page, "2025-06");
    await openWeek(page, "2025-06-09");

    const dayRow = page.locator('tr.day-row[data-day="2025-06-11"]');
    const dayBefore = await readMoney(page, 'tr.day-row[data-day="2025-06-11"] td.num');
    const juneSalesBefore = await readMoney(page, '.year-row[data-month="2025-06"] td:nth-child(2)');
    const yearSalesBefore = await readMoney(page, "tfoot.year-totals td:nth-child(2)");

    await page.locator('.tab-btn[data-view="quarterly"]').click();
    const q1Before = await readMoney(page, '[data-r-key*="VitalTax!C5"]');
    await page.locator('.tab-btn[data-view="year"]').click();

    await addFareViaUI(page, "2025-06-11", { amount: 45, detail: "Airport run" });
    await expect(page.locator("#toast")).toContainText("Added a fare of £45.00");

    await expect.poll(async () => readMoney(page, 'tr.day-row[data-day="2025-06-11"] td.num')).toBe(dayBefore + 45);
    expect(await dayRow.locator("td").nth(1).innerText()).toContain("Airport run");
    expect(await readMoney(page, '.year-row[data-month="2025-06"] td:nth-child(2)')).toBe(juneSalesBefore + 45);
    expect(await readMoney(page, "tfoot.year-totals td:nth-child(2)")).toBe(yearSalesBefore + 45);

    await page.locator('.tab-btn[data-view="quarterly"]').click();
    expect(await readMoney(page, '[data-r-key*="VitalTax!C5"]')).toBe(q1Before + 45);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(
      BASIC_DIR,
      (book, lines) =>
        addSaleLine(book, lines, {
          line: {
            entryNumber: "NEW-0001",
            sourceJournalID: "sales",
            postingDate: "2025-06-11",
            accountMainID: "4000",
            amount: 45,
            documentType: "receipt",
            detailComment: "Airport run",
          },
        }),
      "taxi",
    );
    expect(browserReport).toBe(nodeReport.text);
  });

  test("the saved workbook carries one row for the day, sum and joined names, which the CLI re-extracts as one line", async ({ page }) => {
    await openBook(page, /taxi-scenario-basic/);
    await openMonth(page, "2025-06");
    await openWeek(page, "2025-06-09");
    await addFareViaUI(page, "2025-06-11", { amount: 45, detail: "Airport run" });
    await expect(page.locator("#toast")).toContainText("Added a fare of £45.00");

    await page.click("#save-btn");
    const item = page.getByRole("menuitem", { name: "Download taxi-excel.xlsx", exact: true });
    await item.waitFor({ state: "visible" });
    const [download] = await Promise.all([page.waitForEvent("download"), item.click()]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const workbookPath = path.join(TARGET_DIR, "e1a-workbook.xlsx");
    fs.writeFileSync(workbookPath, Buffer.concat(chunks));

    const outDir = path.join(TARGET_DIR, "e1a-export");
    execFileSync(process.execPath, ["app/bin/export.js", "--package", "taxi", "--file", workbookPath, "--output-dir", outDir], {
      cwd: ROOT,
      stdio: "pipe",
    });
    const lines = fs
      .readFileSync(path.join(outDir, "lines.jsonl"), "utf-8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const dayLines = lines.filter((l) => l.sourceJournalID === "sales" && l.postingDate === "2025-06-11");
    expect(dayLines).toHaveLength(1);
    expect(dayLines[0].amount).toBeCloseTo(245, 2);
    expect(dayLines[0].detailComment).toBe("Daily fares; Airport run");
  });
});

// ── E1b: a fare dated outside the grid refuses the save, by name ───────────

test.describe("DIYA-GL Taxi books page — E1: a fare dated outside the grid refuses the save", () => {
  test("save names the off-grid date; the helper moves it and the save then succeeds", async ({ page }) => {
    await openBook(page, /taxi-scenario-basic/);

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const offGrid = {
        entryNumber: "OFFGRID-0001",
        sourceJournalID: "sales",
        postingDate: "2024-04-01",
        accountMainID: "4000",
        amount: 50,
        documentType: "receipt",
        detailComment: "Booked before the year started",
      };
      await window.DiyaGlBooksPage.setLines(snapshot.lines.concat([offGrid]), "test: an off-grid fare");
    });
    await page.waitForFunction(() => window.DIYA_BOOKS_SNAPSHOT.edited === true);

    await expect(page.locator(".takings-offgrid")).toContainText("2024-04-01");
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/fail/);

    await page.click("#save-btn");
    const xlsxItem = page.getByRole("menuitem", { name: "Download taxi-excel.xlsx", exact: true });
    await xlsxItem.waitFor({ state: "visible" });
    await xlsxItem.click();
    await expect(page.locator("#toast")).toContainText("2024-04-01");
    await expect(page.locator("#toast")).toContainText("Could not generate the download");

    await page.locator('[data-offgrid-helper="book-dates-in-period"]').click();
    await expect(page.locator("#toast")).toContainText("Moved");
    await expect(page.locator(".takings-offgrid")).toHaveCount(0);
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/pass/);

    await page.click("#save-btn");
    await xlsxItem.waitFor({ state: "visible" });
    const [download] = await Promise.all([page.waitForEvent("download"), xlsxItem.click()]);
    expect(download.suggestedFilename()).toBe("taxi-excel.xlsx");
    await expect(page.locator("#toast")).toContainText("Saved taxi-excel.xlsx");
  });
});

// ── E1c: add other income ───────────────────────────────────────────────────

test.describe("DIYA-GL Taxi books page — E1: add other income", () => {
  test("B24, VitalTax Q1 other income and SE Short box 30 move; turnover does not", async ({ page }) => {
    await openBook(page, /taxi-scenario-basic/);
    await openMonth(page, "2025-06");
    await openWeek(page, "2025-06-09");

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    const b5Before = await readMoney(page, '[data-r-key*="Profit & Loss Acc!B5"]');
    const b24Before = await readMoney(page, '[data-r-key*="Profit & Loss Acc!B24"]');
    await page.locator('.tab-btn[data-view="quarterly"]').click();
    const c6Before = await readMoney(page, '[data-r-key*="VitalTax!C6"]');
    await page.locator('.tab-btn[data-view="sa103s"]').click();
    const o99Before = await readMoney(page, '[data-r-key*="SE Short!O99"]');

    await page.locator('.tab-btn[data-view="year"]').click();
    await openMonth(page, "2025-06");
    await openWeek(page, "2025-06-09");
    await addCaptionViaUI(page, "other-income", "2025-06-09", 80);
    await expect(page.locator("#toast")).toContainText("Added other income of £80.00");

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect.poll(async () => readMoney(page, '[data-r-key*="Profit & Loss Acc!B24"]')).toBe(b24Before + 80);
    expect(await readMoney(page, '[data-r-key*="Profit & Loss Acc!B5"]')).toBe(b5Before);

    await page.locator('.tab-btn[data-view="quarterly"]').click();
    expect(await readMoney(page, '[data-r-key*="VitalTax!C6"]')).toBe(c6Before + 80);

    await page.locator('.tab-btn[data-view="sa103s"]').click();
    expect(await readMoney(page, '[data-r-key*="SE Short!O99"]')).toBe(o99Before + 80);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(
      BASIC_DIR,
      (book, lines) =>
        addSaleLine(book, lines, {
          line: {
            entryNumber: "NEW-0001",
            sourceJournalID: "sales",
            postingDate: "2025-06-15",
            accountMainID: "4001",
            amount: 80,
            documentType: "invoice",
            detailComment: "Any other income",
          },
        }),
      "taxi",
    );
    expect(browserReport).toBe(nodeReport.text);
  });
});

// ── E1d: change a day's miles ────────────────────────────────────────────
//
// SP Sixty already claims the mileage route by a wide margin (CONTEXT_TAXI.md:
// a 7,420 allowance against 4,640 of actual running costs), so a single fare
// day's miles cannot swing the book across that gap on its own -- proving the
// route flips when the claim crosses PurchasesMar!J1 is taxi-sp-sixty.test.js's
// own job, run against the recalculated sheet (see CONTEXT_TAXI.md's E2E
// section). What this case proves in the browser is the half that test
// cannot: that editing a day's own miles through the page moves the year's
// business miles and its mileage claim, and that the browser's own R agrees
// with Node's for the same edit, both anchored to the JS engine's live
// figures rather than a hand-computed banding sum.

test.describe("DIYA-GL Taxi books page — E1: change a day's miles", () => {
  test("PurchasesMar!A1 and A2 move by the changed miles, and the browser agrees with Node", async ({ page }) => {
    await openBook(page, /taxi-scenario-sp-sixty/);
    await openMonth(page, "2025-04");
    await openWeek(page, "2025-04-07");

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    const milesBefore = await readMoney(page, '[data-figure="miles"] .figure-value');
    const allowanceBefore = await readMoney(page, '[data-figure="allowance"] .figure-value');

    await page.locator('.tab-btn[data-view="year"]').click();
    await openMonth(page, "2025-04");
    await openWeek(page, "2025-04-07");
    const milesInput = page.locator('[data-miles-entry="TXN-0001"]');
    await milesInput.fill("150");
    await milesInput.press("Enter");
    await expect(page.locator("#toast")).toContainText("miles");

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect.poll(async () => readMoney(page, '[data-figure="miles"] .figure-value')).toBe(milesBefore + 56);
    const allowanceAfter = await readMoney(page, '[data-figure="allowance"] .figure-value');
    expect(allowanceAfter).not.toBe(allowanceBefore);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(
      SP_SIXTY_DIR,
      (book, lines) => changeLineQuantity(book, lines, { entryNumber: "TXN-0001", quantity: 150, unit: "miles" }),
      "taxi",
    );
    expect(browserReport).toBe(nodeReport.text);

    // The browser's own recompute is what the rendered allowance has to
    // match -- not a hand-derived banding sum, which would duplicate the
    // engine's own rate logic instead of checking it.
    const nodeDoc = JSON.parse(nodeReport.text);
    const nodeAllowance = Number(nodeDoc.values.find((v) => v.key === "cell/PurchasesMar!A2").value);
    expect(allowanceAfter).toBeCloseTo(nodeAllowance, 2);
  });
});

// ── E2: warnings, driven pass -> fail -> (helper) -> pass ──────────────────

test.describe("DIYA-GL Taxi books page — E2: dates in period (purchases)", () => {
  test("a purchases entry dated outside the period is caught and moved back into it", async ({ page }) => {
    await openBook(page, /taxi-scenario-kestrel/);
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/pass/);

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const outOfPeriod = {
        entryNumber: "E2-OFFPERIOD",
        sourceJournalID: "purchases",
        postingDate: "2024-05-10",
        accountMainID: "6200",
        amount: 45,
        documentType: "invoice",
        detailComment: "Last year's stationery",
      };
      await window.DiyaGlBooksPage.setLines(snapshot.lines.concat([outOfPeriod]), "test: a purchases line before the period");
    });
    await page.waitForFunction(() => window.DIYA_BOOKS_SNAPSHOT.edited === true);

    const check = bookCheck(page, "book-dates-in-period");
    await expect(check).toHaveClass(/fail/);
    await expect(check).toContainText("2024-05-10");

    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("date 2024-05-10 →");
    await check.locator("[data-helper-apply]").click();
    await expect(page.locator("#toast")).toContainText("applied");
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/pass/);
  });
});

test.describe("DIYA-GL Taxi books page — E2: a fare day has no miles", () => {
  test("clearing a fare day's miles trips the warning; the helper focuses it, and typing new miles clears it", async ({ page }) => {
    await openBook(page, /taxi-scenario-sp-sixty/);
    await expect(bookCheck(page, "book-taxi-fare-miles")).toHaveClass(/pass/);

    await openMonth(page, "2025-04");
    await openWeek(page, "2025-04-07");
    const milesInput = page.locator('[data-miles-entry="TXN-0001"]');
    await milesInput.fill("");
    await milesInput.press("Enter");

    const check = bookCheck(page, "book-taxi-fare-miles");
    await expect(check).toHaveClass(/fail|warn/);
    await expect(check).toContainText("TXN-0001");

    await check.locator('[data-helper-focus="book-taxi-fare-miles"][data-focus-entry="TXN-0001"]').click();
    const focused = page.locator('[data-miles-entry="TXN-0001"]');
    await expect(focused).toBeFocused();

    await focused.fill("94");
    await focused.press("Enter");
    await expect(bookCheck(page, "book-taxi-fare-miles")).toHaveClass(/pass/);
  });
});

test.describe("DIYA-GL Taxi books page — E2: a vehicle bought is not on the register", () => {
  test("a second 7000 line with no matching register entry warns; the helper registers it", async ({ page }) => {
    await openBook(page, /taxi-scenario-basic/);
    await expect(bookCheck(page, "book-taxi-vehicle-register")).toHaveClass(/pass/);

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const secondVehicle = {
        entryNumber: "E2-VEHICLE",
        sourceJournalID: "purchases",
        postingDate: "2025-08-15",
        accountMainID: "7000",
        amount: 3500,
        documentType: "invoice",
        detailComment: "Second-hand runner",
      };
      await window.DiyaGlBooksPage.setLines(snapshot.lines.concat([secondVehicle]), "test: an unregistered vehicle");
    });
    await page.waitForFunction(() => window.DIYA_BOOKS_SNAPSHOT.edited === true);

    const check = bookCheck(page, "book-taxi-vehicle-register");
    await expect(check).toHaveClass(/fail|warn/);
    await expect(check).toContainText("E2-VEHICLE");

    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("asset");
    await check.locator("[data-helper-apply]").click();
    await expect(bookCheck(page, "book-taxi-vehicle-register")).toHaveClass(/pass/);

    await page.locator('.tab-btn[data-view="fixed-assets"]').click();
    await expect(page.locator("table.register-table tbody tr")).toHaveCount(2);
  });
});

test.describe("DIYA-GL Taxi books page — E2: an out-of-chart account reposts to 6200, never 5100", () => {
  test("a line posted to 5002 is caught and reposted to 6200", async ({ page }) => {
    await openBook(page, /taxi-scenario-basic/);
    await expect(bookCheck(page, "book-accounts-in-chart")).toHaveClass(/pass/);

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const imported = {
        entryNumber: "E2-5002",
        sourceJournalID: "purchases",
        postingDate: "2025-07-10",
        accountMainID: "5002",
        amount: 60,
        documentType: "invoice",
        detailComment: "Posted against a BST-only code",
      };
      await window.DiyaGlBooksPage.setLines(snapshot.lines.concat([imported]), "test: an out-of-chart account");
    });
    await page.waitForFunction(() => window.DIYA_BOOKS_SNAPSHOT.edited === true);

    const check = bookCheck(page, "book-accounts-in-chart");
    await expect(check).toHaveClass(/fail/);
    await expect(check).toContainText("5002");

    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("account 5002 → 6200");
    await check.locator("[data-helper-apply]").click();
    await expect(bookCheck(page, "book-accounts-in-chart")).toHaveClass(/pass/);

    const movedRow = page.locator('tr.entry-row[data-entry="E2-5002"] .entry-account-code');
    await expect(movedRow).toHaveText("6200");
  });
});
