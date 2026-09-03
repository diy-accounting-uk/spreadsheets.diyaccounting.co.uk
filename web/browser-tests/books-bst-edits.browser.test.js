// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-bst-edits.browser.test.js
// The books page's edit path, undo stack and fix-it helpers, driven through
// the page itself.
//
// Every assertion is anchored in a figure the page renders, never in the
// page's own internal state: an added purchase of X has to drop the Net
// Profit column of the rendered year table by exactly X with Sales Turnover
// unmoved, or the edit did not reach the calculator. The helper proofs go
// the other way round -- a deliberate breaking edit is typed into the grid
// first, the book check has to notice it, and the fix-it has to clear it
// while every engine check stays green.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "reports/screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });

const DESKTOP_LANDSCAPE = { width: 1440, height: 900 };

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

// ── Reading the rendered year table ────────────────────────────────────────
// The figures the assertions move are read back out of the DOM the reader
// sees, parsed from their rendered currency strings, so a check can only
// pass if the page actually printed the new number.

const COLUMNS = { sales: 1, netProfit: 17 };

function parseMoney(text) {
  return Number(String(text).replace(/[£,\s]/g, ""));
}

async function yearTotal(page, column) {
  const cells = page.locator("tfoot.year-totals td");
  return parseMoney(await cells.nth(COLUMNS[column] - 1).innerText());
}

async function monthCell(page, monthKey, column) {
  const row = page.locator(`.year-row[data-month="${monthKey}"]`);
  return parseMoney(await row.locator("td").nth(COLUMNS[column]).innerText());
}

async function openBook(page, example = /bst-scenario-basic/) {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
  await page.goto(`${baseUrl}/books/bst.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: example }).click();
  await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 30_000 });
}

// April is the month the fixture opens on and the one it carries entries
// for, so every hand edit below is made in a grid that is already showing.
async function openAprilEntries(page) {
  const april = page.locator('.year-row[data-month="2025-04"]');
  if ((await april.getAttribute("aria-expanded")) !== "true") await april.click();
  const toggle = page.locator("#entries-toggle");
  if ((await toggle.innerText()).includes("Show entries")) await toggle.click();
  await expect(page.locator("table.entries-table")).toHaveCount(2);
}

// A commit is asynchronous -- the whole book recalculates before the page
// re-renders -- so the helpers below wait on a rendered consequence rather
// than on the click returning. The add row's own amount field clearing is
// the signal that the entry landed and the grid was rebuilt.
async function addEntry(page, journal, { date, account, detail, amount }) {
  const row = page.locator(`.entry-add-row[data-add-journal="${journal}"]`);
  if (date) await row.locator('[data-add-field="date"]').fill(date);
  if (account) await row.locator('[data-add-field="account"]').selectOption(account);
  if (detail) await row.locator('[data-add-field="detail"]').fill(detail);
  await row.locator('[data-add-field="amount"]').fill(String(amount));
  await row.locator("[data-add-entry]").click();
  await expect(page.locator(`.entry-add-row[data-add-journal="${journal}"] [data-add-field="amount"]`)).toHaveValue("");
}

async function expectYearTable(page, text) {
  await expect.poll(() => page.locator(".year-table").innerText()).toBe(text);
}

async function expectYearTotal(page, column, value) {
  await expect.poll(() => yearTotal(page, column)).toBe(value);
}

function bookCheck(page, id) {
  return page.locator(`#inspector [data-book-check="${id}"]`);
}

async function allChecksPass(page) {
  await expect(page.locator("#inspector .check-item.fail")).toHaveCount(0);
}

test.describe("DIYA-GL books page — in-place edits", () => {
  test("an added purchase of X lowers profit by X and leaves turnover alone", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const salesBefore = await yearTotal(page, "sales");
    const profitBefore = await yearTotal(page, "netProfit");
    const aprilProfitBefore = await monthCell(page, "2025-04", "netProfit");

    await addEntry(page, "purchases", { date: "2025-04-15", account: "5500", detail: "Extra advertising", amount: 250 });
    await expect(page.locator("#toast")).toContainText("Added a purchases entry of £250.00");

    expect(await yearTotal(page, "sales")).toBe(salesBefore);
    expect(await yearTotal(page, "netProfit")).toBe(profitBefore - 250);
    expect(await monthCell(page, "2025-04", "netProfit")).toBe(aprilProfitBefore - 250);
    await allChecksPass(page);

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-entries-grid-edit.png"), fullPage: false });
  });

  test("an added sale of Y raises turnover and profit by Y", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const salesBefore = await yearTotal(page, "sales");
    const profitBefore = await yearTotal(page, "netProfit");

    await addEntry(page, "sales", { date: "2025-04-20", account: "4001", detail: "Extra licence", amount: 400 });
    await expect(page.locator("#toast")).toContainText("Added a sales entry of £400.00");

    expect(await yearTotal(page, "sales")).toBe(salesBefore + 400);
    expect(await yearTotal(page, "netProfit")).toBe(profitBefore + 400);
    await allChecksPass(page);
  });

  test("changing a line's amount moves its month and the year by the difference", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const salesBefore = await yearTotal(page, "sales");
    const aprilSalesBefore = await monthCell(page, "2025-04", "sales");

    const amountField = page.locator('.entries-table[data-journal="sales"] .entry-amount-input').first();
    const was = Number(await amountField.inputValue());
    await amountField.fill(String(was + 175));
    await amountField.press("Enter");
    await expect(page.locator("#toast")).toContainText("Changed");

    await expectYearTotal(page, "sales", salesBefore + 175);
    expect(await monthCell(page, "2025-04", "sales")).toBe(aprilSalesBefore + 175);
    await allChecksPass(page);
  });

  test("removing a line takes its amount back out of the month and the year", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const salesBefore = await yearTotal(page, "sales");
    const firstRow = page.locator('.entries-table[data-journal="sales"] tbody tr.entry-row').first();
    const removedAmount = Number(await firstRow.locator(".entry-amount-input").inputValue());
    const removedEntry = await firstRow.getAttribute("data-entry");

    await firstRow.locator("[data-delete-entry]").click();
    await expect(page.locator("#toast")).toContainText("Removed " + removedEntry);

    await expectYearTotal(page, "sales", salesBefore - removedAmount);
    await expect(page.locator(`tr.entry-row[data-entry="${removedEntry}"]`)).toHaveCount(0);
    await allChecksPass(page);
  });

  test("an entry names its account, keeps its detail on one line, and offers undo when removed", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const row = page.locator('.entries-table[data-journal="purchases"] tbody tr.entry-row').first();
    const code = await row.locator(".entry-account-code").innerText();
    await expect(row.locator(".entry-account-name")).not.toBeEmpty();
    expect(code).toMatch(/^\d+$/);

    // The whole detail is on the element's title even when the cell shows
    // only as much as fits.
    const detail = row.locator(".entry-detail");
    const [shown, title] = await Promise.all([detail.innerText(), detail.getAttribute("title")]);
    expect(title).toContain(shown.replace("…", "").trim());

    const remove = row.locator("[data-delete-entry]");
    await expect(remove).toHaveAttribute("aria-label", /Remove entry/);

    const profitBefore = await yearTotal(page, "netProfit");
    await remove.click();
    const toast = page.locator("#toast");
    await expect(toast).toContainText("Removed");
    await toast.locator(".toast-action-btn").click();
    await expectYearTotal(page, "netProfit", profitBefore);
  });

  test("a typed non-amount is refused and leaves the line where it was", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const salesBefore = await yearTotal(page, "sales");
    const amountField = page.locator('.entries-table[data-journal="sales"] .entry-amount-input').first();
    const was = await amountField.inputValue();

    await amountField.fill("not a number");
    await amountField.press("Enter");
    await expect(page.locator("#toast")).toContainText("That is not an amount");

    await expect(amountField).toHaveValue(was);
    expect(await yearTotal(page, "sales")).toBe(salesBefore);
  });
});

test.describe("DIYA-GL books page — a book started from nothing", () => {
  test("a brand-new book takes its first entry in the grid", async ({ page }) => {
    await page.setViewportSize(DESKTOP_LANDSCAPE);
    await page.goto(`${baseUrl}/books/bst.html`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Start a new book" }).click();
    await page.locator("#new-book-name").fill("Acorn Trading");
    await page.locator("#new-book-year-end").fill("2026-03-31");
    await page.getByRole("button", { name: "Create book" }).click();
    await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 30_000 });

    // The new book's own chart is what the add row offers, and April opens
    // on an empty grid with nothing but the row under the rule.
    await openAprilEntries(page);
    await expect(page.locator(".entries-table tbody tr.entry-row")).toHaveCount(0);
    expect(await yearTotal(page, "sales")).toBe(0);

    await addEntry(page, "sales", { date: "2025-04-06", account: "4000", detail: "First invoice", amount: 1500 });
    await expectYearTotal(page, "sales", 1500);
    await expectYearTotal(page, "netProfit", 1500);
    await allChecksPass(page);
  });
});

test.describe("DIYA-GL books page — undo", () => {
  test("undo restores the exact prior render, by button and by keyboard", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const before = await page.locator(".year-table").innerText();
    await expect(page.locator("#undo-btn")).toHaveClass(/hidden/);

    await addEntry(page, "purchases", { date: "2025-04-15", account: "5500", detail: "Undo me", amount: 999 });
    expect(await page.locator(".year-table").innerText()).not.toBe(before);
    await expect(page.locator("#undo-btn")).not.toHaveClass(/hidden/);

    await page.locator("#undo-btn").click();
    await expectYearTable(page, before);
    await expect(page.locator("#undo-btn")).toHaveClass(/hidden/);

    // The same again through the keyboard, so the shortcut is not a second
    // path that only looks like the button.
    await addEntry(page, "purchases", { date: "2025-04-15", account: "5500", detail: "Undo me again", amount: 123 });
    expect(await page.locator(".year-table").innerText()).not.toBe(before);
    await page.keyboard.press("ControlOrMeta+z");
    await expectYearTable(page, before);
    await expect(page.locator("#undo-btn")).toHaveClass(/hidden/);
  });

  test("mobile portrait offers undo in the bottom action bar", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);
    const start = await yearTotal(page, "netProfit");
    await addEntry(page, "purchases", { date: "2025-04-15", account: "5500", detail: "Undo me on a phone", amount: 60 });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("#mobile-action-bar")).toBeVisible();
    await expect(page.locator("#undo-btn-mobile")).toBeVisible();

    await page.locator("#undo-btn-mobile").click();
    await expect(page.locator("#undo-btn-mobile")).toBeHidden();

    // Back on a landscape desktop, the year table shows the book restored.
    await page.setViewportSize(DESKTOP_LANDSCAPE);
    await expectYearTotal(page, "netProfit", start);
  });

  test("undo walks back through several edits one at a time", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const start = await yearTotal(page, "netProfit");
    await addEntry(page, "purchases", { date: "2025-04-15", account: "5500", detail: "First", amount: 100 });
    await addEntry(page, "purchases", { date: "2025-04-16", account: "5500", detail: "Second", amount: 200 });
    expect(await yearTotal(page, "netProfit")).toBe(start - 300);

    await page.locator("#undo-btn").click();
    await expectYearTotal(page, "netProfit", start - 100);

    await page.locator("#undo-btn").click();
    await expect(page.locator("#undo-btn")).toHaveClass(/hidden/);
    await expectYearTotal(page, "netProfit", start);
  });
});

test.describe("DIYA-GL books page — the rung: helpers fix a deliberately broken book", () => {
  test("the featured book passes every book check before anything is broken", async ({ page }) => {
    await openBook(page);
    for (const id of ["book-dates-in-period", "book-accounts-in-chart", "book-amounts-whole-pence"]) {
      await expect(bookCheck(page, id)).toHaveClass(/pass/);
    }
    await expect(page.locator("#inspector .book-checks-list .check-item.fail")).toHaveCount(0);
    await allChecksPass(page);
  });

  test("the panel opens on what needs attention and folds what passes behind one line", async ({ page }) => {
    await openBook(page);

    // This book's turnover is far past the VAT registration threshold, so
    // its warning is one of the rows the panel opens on.
    const vat = bookCheck(page, "book-vat-threshold");
    await expect(vat).toBeVisible();
    await expect(vat).toHaveClass(/warn/);
    await expect(vat).toContainText("Warning");
    await expect(vat).toContainText("VAT registration threshold");

    // Every passing check is still there, behind a disclosure that says how
    // many there are rather than printing them all.
    const engineSummary = page.locator("#inspector .checks-list .checks-passing summary");
    await expect(engineSummary).toHaveText(/^\d+ checks pass$/);
    await expect(page.locator("#inspector .checks-list .checks-passing .check-item.pass").first()).toBeHidden();
    await engineSummary.click();
    await expect(page.locator("#inspector .checks-list .checks-passing .check-item.pass").first()).toBeVisible();
  });

  test("an entry dated outside the period is caught and moved back into it", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const profitBefore = await yearTotal(page, "netProfit");
    await addEntry(page, "purchases", { date: "2024-05-10", account: "5500", detail: "Last year's advertising", amount: 500 });

    const check = bookCheck(page, "book-dates-in-period");
    await expect(check).toHaveClass(/fail/);
    await expect(check).toContainText("2024-05-10");
    // Exactly this check moved: one defect, one flipped verdict.
    await expect(page.locator("#inspector .book-checks-list .check-item.fail")).toHaveCount(1);
    await expect(page.locator("#inspector .checks-list .check-item.fail")).toHaveCount(0);

    // The check names the line, so the entry it is talking about can be
    // followed all the way through the fix.
    const offender = await check.locator(".check-offenders li").first().innerText();
    const entryNumber = offender.split(" · ")[0];
    // Dated outside the twelve months, it belongs to no month's grid.
    await expect(page.locator(`tr.entry-row[data-entry="${entryNumber}"]`)).toHaveCount(0);

    await check.locator("[data-helper-preview]").click();
    const preview = check.locator(".helper-changes li");
    await expect(preview).toHaveCount(1);
    await expect(preview).toContainText("date 2024-05-10 → 2025-04-01");

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-helper-preview.png"), fullPage: false });

    await check.locator("[data-helper-apply]").click();
    await expect(page.locator("#toast")).toContainText("applied");
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/pass/);
    await allChecksPass(page);

    // The entry itself is still there, still £500 against the same account,
    // now sitting in April of the book's own year.
    const moved = page.locator(`.entries-table[data-journal="purchases"] tr.entry-row[data-entry="${entryNumber}"]`);
    await expect(moved).toHaveCount(1);
    await expect(moved.locator(".entry-amount-input")).toHaveValue("500.00");
    expect(await yearTotal(page, "netProfit")).toBe(profitBefore - 500);

    // Undo puts the broken book back, helper and all: the whole plan was one
    // step, and the entry is out of the period again.
    await page.locator("#undo-btn").click();
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/fail/);
    await expect(page.locator(`tr.entry-row[data-entry="${entryNumber}"]`)).toHaveCount(0);
  });

  test("an entry posted outside the chart is caught and reposted so its money arrives", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const profitBefore = await yearTotal(page, "netProfit");

    // The add-entry row only offers accounts the book's own chart carries,
    // so this defect cannot be typed in -- it arrives with the data. The
    // line is installed the way a book from another surface would land,
    // through the page's own setLines seam.
    await page.evaluate(async () => {
      const snapshot = window.DIYA_BST_SNAPSHOT;
      const imported = {
        entryNumber: "IMPORT-0001",
        sourceJournalID: "purchases",
        postingDate: "2025-04-18",
        accountMainID: "5999",
        amount: 700,
        documentType: "invoice",
        detailComment: "Imported against a code this book has no account for",
      };
      await window.DiyaGlBooksPage.setLines(snapshot.lines.concat([imported]), "import a line");
    });

    // The amount reached no total: the money is simply not in the book.
    expect(await yearTotal(page, "netProfit")).toBe(profitBefore);

    const check = bookCheck(page, "book-accounts-in-chart");
    await expect(check).toHaveClass(/fail/);
    await expect(check).toContainText("5999");
    await expect(page.locator("#inspector .book-checks-list .check-item.fail")).toHaveCount(1);
    await expect(page.locator("#inspector .checks-list .check-item.fail")).toHaveCount(0);

    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("account 5999 → 5002");

    await check.locator("[data-helper-apply]").click();
    await expect(bookCheck(page, "book-accounts-in-chart")).toHaveClass(/pass/);
    await allChecksPass(page);

    // Reposted, the £700 now lands in the expenses it always belonged in.
    expect(await yearTotal(page, "netProfit")).toBe(profitBefore - 700);
  });

  test("an amount finer than a penny is caught and rounded", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    await addEntry(page, "purchases", { date: "2025-04-19", account: "5500", detail: "Third of a bill", amount: 100.005 });

    const check = bookCheck(page, "book-amounts-whole-pence");
    await expect(check).toHaveClass(/fail/);
    await expect(page.locator("#inspector .book-checks-list .check-item.fail")).toHaveCount(1);
    await expect(page.locator("#inspector .checks-list .check-item.fail")).toHaveCount(0);
    const entryNumber = (await check.locator(".check-offenders li").first().innerText()).split(" · ")[0];

    await check.locator("[data-helper-preview]").click();
    const preview = check.locator(".helper-changes li");
    await expect(preview).toHaveCount(1);
    await expect(preview).toContainText("amount 100.005 → 100.01");

    await check.locator("[data-helper-apply]").click();
    await expect(bookCheck(page, "book-amounts-whole-pence")).toHaveClass(/pass/);
    await allChecksPass(page);

    // The sheet's own P&L columns round to the pound, so the fix shows on
    // the line itself: the amount the book carries is now a real penny
    // figure rather than a third of one.
    const rounded = page.locator(`.entries-table[data-journal="purchases"] tr.entry-row[data-entry="${entryNumber}"] .entry-amount-input`);
    await expect(rounded).toHaveValue("100.01");
  });

  test("no bank-item card: Basic Sole Trader has no bank book to make an entry from", async ({ page }) => {
    await openBook(page);
    await expect(page.locator("#inspector")).not.toContainText("bank item");
    await expect(page.locator("#inspector .helper-card")).toHaveCount(0);
  });
});

test.describe("DIYA-GL books page — drift after an edit", () => {
  test("an uploaded workbook's drift annotations relabel as recalculated once the book is edited", async ({ page }) => {
    await page.setViewportSize(DESKTOP_LANDSCAPE);
    await page.goto(`${baseUrl}/books/bst.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#file-picker").setInputFiles(path.join(process.cwd(), "examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx"));
    await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 30_000 });

    // A freshly generated package reconciles, so nothing is annotated yet.
    await expect(page.locator(".pencil-correction")).toHaveCount(0);

    await openAprilEntries(page);
    await addEntry(page, "sales", { date: "2025-04-21", account: "4001", detail: "Sale the workbook never saw", amount: 1000 });

    // Now the calculated side has moved away from the cached workbook
    // values, and every annotation says so rather than reading as a
    // reconciliation finding.
    await page.locator('.tab-btn[data-view="income-tax"]').click();
    const corrections = page.locator(".pencil-correction");
    await expect(corrections.first()).toBeVisible();
    await expect(corrections.first().locator(".drift-tag")).toHaveText("recalculated");
    await expect(page.locator("#inspector .drift-summary")).toContainText("Recalculated");

    await page.screenshot({ path: path.join(screenshotsDir, "books-bst-edit-recalculated.png"), fullPage: false });
  });
});
