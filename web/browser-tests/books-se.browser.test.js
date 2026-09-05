// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-se.browser.test.js
//
// The Self Employed page (books/se.html) against the manifest it mounts
// (books/products/se.js): every example loads with no uncaught error and
// nothing blocked by the content security policy, every view renders a
// figure R can be joined to, the year total is the profit and loss
// account's own turnover as report.js computes it, the journal switch shows
// one of the five journals at a time, the bank book's closing balance is
// the March tab's own cell, an edit recalculates the whole book, and the
// new-book form builds an empty Self Employed book.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";
import { s2 } from "./r-sources.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const BOOK_DIR = "examples/precision-code-ltd/advanced";
const FEATURED_EXAMPLE = "se-scenario-advanced";
const OPEN_MONTH = "2025-04";

const SE_EXAMPLES = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts/example-books.json"), "utf-8")).se;

const TURNOVER_KEY = "cell/Financialaccounts.xlsx!Profit & Loss Account!B9";
const BANK_CLOSING_KEY = "cell/Bank.xlsx!Mar!A2";

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

function seUrl(search) {
  return `${baseUrl}/books/se.html${search || ""}`;
}

// Every uncaught error and every console error the page raises while a test
// drives it, so a view that throws is a failure rather than a blank panel.
function watchForErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function openExample(page, key) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(seUrl(`?example=${key}`), { waitUntil: "domcontentloaded" });
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

function money(text) {
  return Number(String(text).replace(/[£,\s]/g, ""));
}

// S2 for the featured book, computed under the Self Employed package.
function seReport() {
  return s2(BOOK_DIR, "se-advanced", "se");
}

function reportFigure(key) {
  const entry = seReport().get(key);
  if (!entry) throw new Error(`report.json carries no value for ${key}`);
  return Number(entry.value);
}

function aprilBankLineCount() {
  return fs
    .readFileSync(path.join(process.cwd(), BOOK_DIR, "lines.jsonl"), "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(
      (line) =>
        line.sourceJournalID === "bank" && String(line["diya-gl:bankAccountID"]) === "1200" && line.postingDate.startsWith(OPEN_MONTH),
    ).length;
}

test.describe("DIYA-GL books — the Self Employed page", () => {
  test("every Self Employed example loads with no uncaught error and nothing the policy blocks", async ({ page }) => {
    expect(SE_EXAMPLES.length).toBeGreaterThan(0);
    for (const example of SE_EXAMPLES) {
      const errors = watchForErrors(page);
      await openExample(page, example.key);
      await expect(page.locator("#app-title .title-business")).toHaveText(example.name);
      expect(errors.filter((text) => /Content Security Policy|Refused to/i.test(text))).toEqual([]);
      expect(errors, `${example.key} loaded without error`).toEqual([]);
    }
  });

  test("the mounted manifest is the Self Employed one and the tab strip is its view list", async ({ page }) => {
    await openExample(page, FEATURED_EXAMPLE);
    expect(await page.evaluate(() => window.DiyaGlBooksPage.manifest.id)).toBe("se");
    expect(await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.book.entityInformation["diya-gl:product"])).toBe("SelfEmployed");
    const tabIds = await page.locator(".tab-btn[data-view]").evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-view")));
    const manifestIds = await page.evaluate(() => window.DiyaGlBooksPage.manifest.views.map((view) => view.id));
    expect(tabIds).toEqual(manifestIds);
  });

  test("the year total is the profit and loss account's own turnover", async ({ page }) => {
    await openExample(page, FEATURED_EXAMPLE);
    const cell = page.locator(`tfoot.year-totals td[data-r-key*="${TURNOVER_KEY}"]`);
    await expect(cell).toHaveCount(1);
    const shown = money(await cell.innerText());
    const expected = reportFigure(TURNOVER_KEY);
    expect(Math.abs(shown - expected) < 0.005).toBe(true);
    // Breakability: the same comparison against a corrupted report figure fails.
    expect(Math.abs(shown - (expected + 0.01)) < 0.005).toBe(false);
  });

  test("every view renders and carries at least one report key", async ({ page }) => {
    const errors = watchForErrors(page);
    await openExample(page, FEATURED_EXAMPLE);
    const viewIds = await page.evaluate(() => window.DiyaGlBooksPage.manifest.views.map((view) => view.id));
    for (const viewId of viewIds) {
      await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
      await expect(page.locator(`.tab-btn[data-view="${viewId}"]`)).toHaveAttribute("aria-selected", "true");
      // Home is a navigation list, not a set of figures.
      if (viewId === "home") {
        await expect(page.locator(".home-nav-list a")).toHaveCount(viewIds.length);
        continue;
      }
      expect(await page.locator("#view-root [data-r-key]").count(), `${viewId} renders a report key`).toBeGreaterThan(0);
    }
    expect(errors).toEqual([]);
  });

  test("the journal switch shows one of the five journals at a time", async ({ page }) => {
    await openExample(page, FEATURED_EXAMPLE);
    const journalIds = await page
      .locator(".journal-switch [data-journal-switch]")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-journal-switch")));
    expect(journalIds).toEqual(["sales", "purchases", "bank", "cash", "payroll"]);
    await expect(page.locator(".entries-table")).toHaveCount(1);
    await expect(page.locator('.entries-table[data-journal="sales"]')).toBeVisible();

    await page.locator('[data-journal-switch="bank"]').click();
    await expect(page.locator('.entries-table[data-journal="bank"]')).toBeVisible();
    await expect(page.locator(".entries-table")).toHaveCount(1);
    await expect(page.locator('.entries-table[data-journal="bank"] tr.entry-row')).toHaveCount(aprilBankLineCount());
  });

  test("the bank book's closing balance is the March tab's own cell", async ({ page }) => {
    await openExample(page, FEATURED_EXAMPLE);
    await page.locator('.tab-btn[data-view="bank"]').click();
    await expect(page.locator(".account-switch [data-account]")).toHaveCount(2);
    const cell = page.locator(`#view-root [data-r-key*="${BANK_CLOSING_KEY}"]`);
    await expect(cell).toHaveCount(1);
    expect(Math.abs(money(await cell.innerText()) - reportFigure(BANK_CLOSING_KEY)) < 0.005).toBe(true);

    await page.locator('[data-account="1220"]').click();
    await expect(page.locator(`#view-root [data-r-key*="cell/Cash.xlsx!Mar!A2"]`)).toHaveCount(1);
  });

  test("changing one sale's amount recalculates the whole book", async ({ page }) => {
    const errors = watchForErrors(page);
    await openExample(page, FEATURED_EXAMPLE);
    const total = page.locator(`tfoot.year-totals td[data-r-key*="${TURNOVER_KEY}"]`);
    const before = money(await total.innerText());

    const amount = page.locator('.entries-table[data-journal="sales"] [data-amount-entry]').first();
    const entered = Number(await amount.inputValue());
    await amount.fill(String(entered + 1200));
    await amount.blur();

    // The gross the reader types is 1,200 more; the statement's turnover is
    // net of VAT, so it moves by 1,000 on this registered book.
    await expect.poll(async () => Math.round((money(await total.innerText()) - before) * 100) / 100, { timeout: 30_000 }).toBe(1000);
    expect(errors).toEqual([]);
  });

  test("the new-book form creates an empty VAT-registered Self Employed book", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".empty-state")).toBeVisible();
    await page.locator("#new-book-btn").click();

    const fieldIds = await page.locator("#new-book-form input").evaluateAll((inputs) => inputs.map((input) => input.id));
    expect(fieldIds).toEqual(["new-book-name", "new-book-year-end", "new-book-vat"]);

    await page.locator("#new-book-name").fill("Test Trader");
    await page.locator("#new-book-year-end").fill("2026-04-05");
    await page.locator("#new-book-vat").check();
    await page.locator('#new-book-form button[type="submit"]').click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    const book = await page.evaluate(() => ({
      lines: window.DIYA_BOOKS_SNAPSHOT.lines.length,
      product: window.DIYA_BOOKS_SNAPSHOT.book.entityInformation["diya-gl:product"],
      vat: window.DIYA_BOOKS_SNAPSHOT.book.entityInformation["diya-gl:vatRegistered"],
      start: window.DIYA_BOOKS_SNAPSHOT.book.documentInfo.periodCoveredStart,
      end: window.DIYA_BOOKS_SNAPSHOT.book.documentInfo.periodCoveredEnd,
    }));
    expect(book).toEqual({ lines: 0, product: "SelfEmployed", vat: true, start: "2025-04-06", end: "2026-04-05" });
    expect(errors).toEqual([]);
  });
});
