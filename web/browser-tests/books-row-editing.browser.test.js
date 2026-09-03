// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-row-editing.browser.test.js
//
// The entries grid's date and account editors, and the year table's default
// column set. Every figure the assertions move is read back out of the
// rendered year table, the same way books-bst-edits.browser.test.js reads
// an amount edit's effect -- an edit that never reaches the calculator
// leaves the totals exactly where they were.

import { test, expect } from "@playwright/test";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");

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
// The year table's own column order (yearTableColumns(), bst.js): the
// seventeen P&L categories in bst-data.js's own order, then the Cost of
// Sales composite appended after all of them so their positions never move.

const COLUMNS = {
  sales: 1,
  generalAdmin: 8,
  advertising: 11,
  otherExpenses: 15,
  totalExpenses: 16,
  netProfit: 17,
  costOfSalesComposite: 18,
};

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

async function openBook(page) {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
  await page.goto(`${baseUrl}/books/bst.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
  await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 30_000 });
}

// April is the month the fixture opens on and carries entries for.
async function openAprilEntries(page) {
  const april = page.locator('.year-row[data-month="2025-04"]');
  if ((await april.getAttribute("aria-expanded")) !== "true") await april.click();
  const toggle = page.locator("#entries-toggle");
  if ((await toggle.innerText()).includes("Show entries")) await toggle.click();
  await expect(page.locator("table.entries-table")).toHaveCount(2);
}

async function enableAllCategories(page) {
  const checkbox = page.locator("#all-categories-toggle");
  if (!(await checkbox.isChecked())) await checkbox.check();
  await expect(page.locator(".year-table-scroll")).toHaveClass(/show-all-categories/);
}

function bookCheck(id) {
  return `#inspector [data-book-check="${id}"]`;
}

// ── Date editing ─────────────────────────────────────────────────────────

test.describe("DIYA-GL books page — entry date editing", () => {
  test("moving an entry's date to another month moves both months' totals and leaves the year alone", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const netProfitBefore = await yearTotal(page, "netProfit");
    const aprilProfitBefore = await monthCell(page, "2025-04", "netProfit");
    const mayProfitBefore = await monthCell(page, "2025-05", "netProfit");

    // TXN-0020: a purchases line dated 2025-04-01, £45.00, account 5002.
    // fill() on a date input sets the value and dispatches input and change
    // together (Playwright's own contract for date/time inputs), so the
    // edit is already committed by the time fill() returns -- an extra
    // Enter would hunt for a row that has already moved out of April's
    // entries table and hang.
    const dateField = page.locator('[data-date-entry="TXN-0020"]');
    await expect(dateField).toHaveValue("2025-04-01");
    await dateField.fill("2025-05-01");
    await expect(page.locator("#toast")).toContainText("Changed TXN-0020's date to 2025-05-01");

    // A purchase's date moving out of April drops April's own expenses (and
    // so raises April's profit) by exactly the amount that left it, and does
    // the opposite to May, the month it landed in.
    await expect.poll(() => monthCell(page, "2025-04", "netProfit")).toBe(aprilProfitBefore + 45);
    await expect.poll(() => monthCell(page, "2025-05", "netProfit")).toBe(mayProfitBefore - 45);
    expect(await yearTotal(page, "netProfit")).toBe(netProfitBefore);
  });

  test("Escape reverts an in-progress date edit", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    // fill() commits immediately (see above), so an in-progress edit here is
    // set directly and given a real "input" event -- the same event a typed
    // digit fires -- rather than through Chromium's own date-segment
    // keyboard editing, whose native Escape handling runs after this page's
    // own listener and overwrites whatever that listener just restored.
    // Escape itself is a real keypress; only the edit that precedes it is
    // synthesised.
    const dateField = page.locator('[data-date-entry="TXN-0022"]');
    const committed = await dateField.inputValue();
    await dateField.evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, "2025-06-15");
    await expect(dateField).toHaveAttribute("data-dirty", "true");
    await dateField.press("Escape");
    await expect(dateField).toHaveValue(committed);
    await expect(dateField).toHaveAttribute("data-dirty", "false");
  });

  test("an out-of-period date is now reachable from the entries grid, and undo restores it", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);
    await expect(page.locator(bookCheck("book-dates-in-period"))).toHaveClass(/pass/);

    const dateField = page.locator('[data-date-entry="TXN-0022"]');
    await dateField.fill("2026-04-15");
    await expect(page.locator("#toast")).toContainText("Changed");

    const check = page.locator(bookCheck("book-dates-in-period"));
    await expect(check).toHaveClass(/fail/);

    await check.locator("[data-helper-preview]").click();
    await expect(check).toContainText("TXN-0022");
    await expect(check).toContainText("2026-04-15");

    await page.locator("#undo-btn").click();
    await expect(page.locator(bookCheck("book-dates-in-period"))).toHaveClass(/pass/);
    await expect(page.locator('[data-date-entry="TXN-0022"]')).toHaveValue("2025-04-01");
  });

  test("the date input is reachable by keyboard and Enter commits the move", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const aprilProfitBefore = await monthCell(page, "2025-04", "netProfit");
    const mayProfitBefore = await monthCell(page, "2025-05", "netProfit");

    const dateField = page.locator('[data-date-entry="TXN-0020"]');
    await dateField.focus();
    await expect(dateField).toBeFocused();
    // A date input's segment order follows the browser's own locale, so the
    // value is set as ISO rather than typed segment by segment; Enter commits.
    await dateField.fill("2025-05-01");
    await dateField.press("Enter");
    await expect(page.locator("#toast")).toContainText("Changed TXN-0020's date to 2025-05-01");

    await expect.poll(() => monthCell(page, "2025-04", "netProfit")).toBe(aprilProfitBefore + 45);
    await expect.poll(() => monthCell(page, "2025-05", "netProfit")).toBe(mayProfitBefore - 45);
  });
});

// ── Account editing ─────────────────────────────────────────────────────

test.describe("DIYA-GL books page — entry account editing", () => {
  test("reposting an entry moves the category columns and leaves the year alone", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);
    await enableAllCategories(page);

    const netProfitBefore = await yearTotal(page, "netProfit");
    const generalAdminBefore = await monthCell(page, "2025-04", "generalAdmin");
    const advertisingBefore = await monthCell(page, "2025-04", "advertising");

    // TXN-0018: a purchases line dated 2025-04-01, £30.00, posted to 5501
    // (General admin). 5500 is Advertising, in the same book's own chart.
    const accountSelect = page.locator('[data-account-entry="TXN-0018"]');
    await expect(accountSelect).toHaveValue("5501");
    await accountSelect.selectOption("5500");
    await expect(page.locator("#toast")).toContainText("Changed TXN-0018's account to 5500");

    await expect.poll(() => monthCell(page, "2025-04", "generalAdmin")).toBe(generalAdminBefore - 30);
    await expect.poll(() => monthCell(page, "2025-04", "advertising")).toBe(advertisingBefore + 30);
    expect(await yearTotal(page, "netProfit")).toBe(netProfitBefore);
  });

  test("an out-of-chart account is not offered: the select carries only the book's own chart", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);

    const accountSelect = page.locator('[data-account-entry="TXN-0018"]');
    const values = await accountSelect.locator("option").evaluateAll((options) => options.map((o) => o.value));
    expect(values).toContain("5501");
    expect(values).not.toContain("9999");
  });

  test("undo restores a reposted entry's category", async ({ page }) => {
    await openBook(page);
    await openAprilEntries(page);
    await enableAllCategories(page);

    const generalAdminBefore = await monthCell(page, "2025-04", "generalAdmin");

    await page.locator('[data-account-entry="TXN-0019"]').selectOption("5500");
    await expect(page.locator("#toast")).toContainText("Changed TXN-0019's account to 5500");
    await expect.poll(() => monthCell(page, "2025-04", "generalAdmin")).not.toBe(generalAdminBefore);

    await page.locator("#undo-btn").click();
    await expect.poll(() => monthCell(page, "2025-04", "generalAdmin")).toBe(generalAdminBefore);
    await expect(page.locator('[data-account-entry="TXN-0019"]')).toHaveValue("5501");
  });
});

// ── The year table's default columns ────────────────────────────────────

test.describe("DIYA-GL books page — year table default columns", () => {
  test("five columns show by default; the toggle reveals the eleven expense columns, hidden cells kept with their r-key", async ({
    page,
  }) => {
    await openBook(page);

    // The composite column carries no r-key of its own (no single cell holds
    // C6+C7's sum), so it is appended after the seventeen category columns
    // rather than spliced among them -- Sales Turnover keeps its own
    // position and Cost of Sales renders last of the five default columns.
    const visibleHeaders = page.locator(".year-table > thead > tr > th:visible");
    await expect(visibleHeaders).toHaveCount(5);
    await expect(visibleHeaders).toContainText(["Month", "Sales Turnover", "Total Expenses", "Net Profit", "Cost of Sales"]);

    // The columns it stands in for still carry their own r-key, present in
    // the DOM though display:none hides them.
    const costOfSalesCell = page.locator('.year-table [data-r-key*="Profit & Loss Acc!C6"]').first();
    await expect(costOfSalesCell).toBeAttached();
    await expect(costOfSalesCell).toBeHidden();

    await enableAllCategories(page);
    await expect(page.locator(".year-table > thead > tr > th:visible")).toHaveCount(16);
    for (const label of [
      "Employee Costs",
      "Premises Costs",
      "Repairs & Maintenance",
      "General Admin",
      "Motor Expenses",
      "Travel & Subsistence",
      "Advertising",
      "Legal & Professional",
      "Bad Debts",
      "Interest & Finance",
      "Other Expenses",
    ]) {
      await expect(page.locator(".year-table > thead > tr > th", { hasText: label })).toBeVisible();
    }
    // Cost of Sales' own two component columns and Gross Profit are still
    // not among the eleven the toggle answers for.
    await expect(costOfSalesCell).toBeHidden();
  });

  test("the toggle's state survives a reload", async ({ page }) => {
    await openBook(page);
    await enableAllCategories(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
    await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 30_000 });

    await expect(page.locator("#all-categories-toggle")).toBeChecked();
    await expect(page.locator(".year-table > thead > tr > th:visible")).toHaveCount(16);
  });
});
