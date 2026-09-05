// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-warnings.browser.test.js
//
// E2 in PLAN_DIYA_GL_BST_CLI_MCP_WEB.md's test approach: a table of
// deliberate actions, each expected to flip exactly one set of book checks
// and warnings, and nothing else. Every test reads every known check's
// state before and after the action, so a row that moves a check it was
// not supposed to fails loudly rather than passing on a partial look.
//
// bookchecks.json in the downloaded diya-gl zip is asserted against the
// panel's own state for two rows, so the file a caller downloads and the
// screen a reader looks at are never allowed to disagree.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { parseFigure } from "./r-sources.js";

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

async function openBook(page, example) {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
  await page.goto(`${baseUrl}/books/bst.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: example }).click();
  await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 30_000 });
}

async function openAprilEntries(page) {
  const april = page.locator('.year-row[data-month="2025-04"]');
  if ((await april.getAttribute("aria-expanded")) !== "true") await april.click();
  const toggle = page.locator("#entries-toggle");
  if ((await toggle.innerText()).includes("Show entries")) await toggle.click();
  await expect(page.locator("table.entries-table")).toHaveCount(2);
}

async function addEntry(page, journal, { date, account, detail, amount }) {
  const row = page.locator(`.entry-add-row[data-add-journal="${journal}"]`);
  if (date) await row.locator('[data-add-field="date"]').fill(date);
  if (account) await row.locator('[data-add-field="account"]').selectOption(account);
  if (detail) await row.locator('[data-add-field="detail"]').fill(detail);
  await row.locator('[data-add-field="amount"]').fill(String(amount));
  await row.locator("[data-add-entry]").click();
  await expect(page.locator(`.entry-add-row[data-add-journal="${journal}"] [data-add-field="amount"]`)).toHaveValue("");
}

function bookCheck(page, id) {
  return page.locator(`#inspector [data-book-check="${id}"]`);
}

// Every book check and warning the panel can show, in the order
// book-checks.js runs them. book-empty-month is left out: no E2 row
// exercises it.
const BOOK_CHECK_IDS = [
  "book-dates-in-period",
  "book-accounts-in-chart",
  "book-amounts-whole-pence",
  "book-vat-threshold",
  "book-duplicate-entries",
  "book-empty-detail",
  "book-negative-amount",
];

async function bookCheckStates(page) {
  const states = {};
  for (const id of BOOK_CHECK_IDS) {
    const cls = (await bookCheck(page, id).getAttribute("class")) || "";
    states[id] = cls.includes(" fail") ? "fail" : cls.includes(" warn") ? "warn" : "pass";
  }
  return states;
}

function flippedIds(before, after) {
  return BOOK_CHECK_IDS.filter((id) => before[id] !== after[id]).sort();
}

// The engine checks' own failing set, read the same way the panel shows it:
// every `[data-r-key="check/<label>"]` row carrying the fail class. Passing
// engine checks fold behind a disclosure, but a fail never does, so this
// never needs to open it.
async function engineFailingSet(page) {
  const items = page.locator("#inspector .checks-list .check-item.fail");
  const count = await items.count();
  const labels = [];
  for (let i = 0; i < count; i++) {
    const key = await items.nth(i).getAttribute("data-r-key");
    labels.push(
      String(key)
        .split(" || ")[0]
        .replace(/^check\//, ""),
    );
  }
  return labels.sort();
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function downloadBookChecksJson(page) {
  await page.click("#save-btn");
  const item = page.getByRole("menuitem", { name: "Download books as diya-gl (.zip)", exact: true });
  await item.waitFor({ state: "visible" });
  const [download] = await Promise.all([page.waitForEvent("download"), item.click()]);
  const bytes = await readDownload(download);
  const zip = await JSZip.loadAsync(bytes);
  return JSON.parse(await zip.file("bookchecks.json").async("string"));
}

test.describe("DIYA-GL books page — E2: deliberate warnings and failures", () => {
  test("an entry dated outside the period flips book-dates-in-period alone", async ({ page }) => {
    await openBook(page, /bst-scenario-basic/);
    await openAprilEntries(page);
    const before = await bookCheckStates(page);

    await addEntry(page, "purchases", { date: "2024-05-10", account: "5500", detail: "Last year's advertising", amount: 500 });

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-dates-in-period"]);
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/fail/);

    const check = bookCheck(page, "book-dates-in-period");
    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("date 2024-05-10 → 2025-04-01");
    await check.locator("[data-helper-apply]").click();
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/pass/);

    await page.locator("#undo-btn").click();
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/fail/);
  });

  test("an entry posted outside the chart flips book-accounts-in-chart alone", async ({ page }) => {
    await openBook(page, /bst-scenario-basic/);
    await openAprilEntries(page);
    const before = await bookCheckStates(page);

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const imported = {
        entryNumber: "IMPORT-0001",
        sourceJournalID: "purchases",
        postingDate: "2025-04-18",
        accountMainID: "5999",
        amount: 700,
        documentType: "invoice",
        detailComment: "Imported against a code this book has no account for",
      };
      await window.DiyaGlBooksPage.setLines(snapshot.lines.concat([imported]), "test: import an out-of-chart line");
    });
    await page.waitForFunction(() => window.DIYA_BOOKS_SNAPSHOT.edited === true);

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-accounts-in-chart"]);
    await expect(bookCheck(page, "book-accounts-in-chart")).toHaveClass(/fail/);

    const check = bookCheck(page, "book-accounts-in-chart");
    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("account 5999 → 5002");
    await check.locator("[data-helper-apply]").click();
    await expect(bookCheck(page, "book-accounts-in-chart")).toHaveClass(/pass/);

    await page.locator("#undo-btn").click();
    await expect(bookCheck(page, "book-accounts-in-chart")).toHaveClass(/fail/);
  });

  // 100.006, not 100.005: at 100.005 the whole-pound round the P&L side
  // takes and the penny round the SA103S side takes land on the same whole
  // pound by coincidence (the fraction sits exactly on both roundings' tie
  // line), so the two sides stay equal and the engine check does not flip.
  // 100.006 sits off that tie line -- the P&L rounds the whole difference
  // to the pound before subtracting the period's expenses, SA103S subtracts
  // first and only then rounds to the penny, so a fraction on a direct-cost
  // line (account 5001) carries through to a disagreement between them.
  // Verified in Node: examples/precision-code-ltd/bst with this one line
  // added fails exactly "SA103S: Net profit close to P&L Net" and
  // "Accounting profit to tax profit bridge closes to zero", nothing else.
  //
  // The whole-pence helper only rounds to the penny, so it cannot repair
  // this: 100.006 becomes a legitimate 100.01, but 100.01 still leaves the
  // direct-cost total short of a whole pound, so the same two engine checks
  // stay failed after the helper runs -- also verified in Node. Only undo,
  // which removes the line outright, brings them back to pass.
  test("an amount finer than a penny flips book-amounts-whole-pence and splits SA103S from the P&L", async ({ page }) => {
    await openBook(page, /bst-scenario-basic/);
    await openAprilEntries(page);
    const before = await bookCheckStates(page);
    const engineBefore = await engineFailingSet(page);
    expect(engineBefore).toEqual([]);

    await addEntry(page, "purchases", { date: "2025-04-19", account: "5001", detail: "Sub-contractor part-invoice", amount: 100.006 });

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-amounts-whole-pence"]);
    await expect(bookCheck(page, "book-amounts-whole-pence")).toHaveClass(/fail/);

    const engineAfter = await engineFailingSet(page);
    expect(engineAfter).toEqual(["Accounting profit to tax profit bridge closes to zero", "SA103S: Net profit close to P&L Net"]);

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    for (const id of ["book-amounts-whole-pence", "book-dates-in-period"]) {
      const entry = bookChecksJson.find((r) => r.id === id);
      expect(entry.result).toBe(panelState[id]);
    }

    const check = bookCheck(page, "book-amounts-whole-pence");
    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("amount 100.006 → 100.01");
    await check.locator("[data-helper-apply]").click();
    await expect(bookCheck(page, "book-amounts-whole-pence")).toHaveClass(/pass/);
    // The book check is clean, but rounding to the penny does not round to
    // the pound: the same two engine checks are still failed here, not a
    // regression -- see the comment above this test.
    expect(await engineFailingSet(page)).toEqual([
      "Accounting profit to tax profit bridge closes to zero",
      "SA103S: Net profit close to P&L Net",
    ]);

    await page.locator("#undo-btn").click();
    await expect(bookCheck(page, "book-amounts-whole-pence")).toHaveClass(/fail/);
    expect(await engineFailingSet(page)).toEqual([
      "Accounting profit to tax profit bridge closes to zero",
      "SA103S: Net profit close to P&L Net",
    ]);
  });

  test("a sale that lifts turnover over the VAT threshold flips book-vat-threshold alone", async ({ page }) => {
    await openBook(page, /bst-brickwork-pro-nonvat/);
    const salesBefore = await page.locator("tfoot.year-totals td").nth(0).innerText();

    await page.locator('.tab-btn[data-view="admin"]').click();
    const thresholdText = await page.locator('[data-r-key*="cell/Admin!F26"]').innerText();
    const threshold = parseFigure(thresholdText).value;
    await page.locator('.tab-btn[data-view="year"]').click();
    await openAprilEntries(page);

    const before = await bookCheckStates(page);
    expect(before["book-vat-threshold"]).toBe("pass");

    const topUp = threshold - parseFigure(salesBefore).value + 100;
    await addEntry(page, "sales", { date: "2025-04-25", account: "4000", detail: "New commercial contract", amount: topUp });

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-vat-threshold"]);
    const vat = bookCheck(page, "book-vat-threshold");
    await expect(vat).toHaveClass(/warn/);
    await expect(vat).toContainText("VAT registration threshold");

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    for (const id of ["book-vat-threshold", "book-accounts-in-chart"]) {
      const entry = bookChecksJson.find((r) => r.id === id);
      expect(entry.result).toBe(panelState[id]);
    }
  });

  test("an identical second entry flips book-duplicate-entries alone", async ({ page }) => {
    await openBook(page, /bst-brickwork-pro-nonvat/);
    await openAprilEntries(page);
    const before = await bookCheckStates(page);

    const entry = { date: "2025-04-08", account: "4000", detail: "Repeat billing test", amount: 640 };
    await addEntry(page, "sales", entry);
    const afterFirst = await bookCheckStates(page);
    expect(flippedIds(before, afterFirst)).toEqual([]);

    await addEntry(page, "sales", entry);
    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-duplicate-entries"]);
    await expect(bookCheck(page, "book-duplicate-entries")).toHaveClass(/warn/);
  });

  test("an entry with no detail flips book-empty-detail alone", async ({ page }) => {
    await openBook(page, /bst-brickwork-pro-nonvat/);
    await openAprilEntries(page);
    const before = await bookCheckStates(page);

    await addEntry(page, "purchases", { date: "2025-04-12", account: "5000", amount: 133 });

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-empty-detail"]);
    await expect(bookCheck(page, "book-empty-detail")).toHaveClass(/warn/);
  });

  test("a negative amount flips book-negative-amount alone", async ({ page }) => {
    await openBook(page, /bst-brickwork-pro-nonvat/);
    await openAprilEntries(page);
    const before = await bookCheckStates(page);

    await addEntry(page, "purchases", { date: "2025-04-14", account: "5000", detail: "Supplier credit note", amount: -50 });

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-negative-amount"]);
    await expect(bookCheck(page, "book-negative-amount")).toHaveClass(/warn/);
  });

  // The mileage route: bst-sp-sixty carries its whole year's business miles
  // on one purchases-journal "mileage-log" line. Both mileage checks read
  // that same line afresh from the current lines on every recalculation --
  // the calculator's own running total (results.PurchasesMar.C1) and the
  // fixture-side total checkCompliance compares it against
  // (expected.total_mileage) are each computed straight off the edited
  // line's own measurableQuantity, by different code, but from the same one
  // number. Editing it via setLines moves both sides together, so neither
  // mileage check is reachable from a UI edit on this scenario: verified in
  // Node (see the probe alongside this task's report) across a spread of
  // edited quantities, none of which split the two figures apart.
  test("an edited mileage quantity moves the claim but leaves both mileage checks passing", async ({ page }) => {
    await openBook(page, /bst-sp-sixty/);
    const before = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.report.values.find((v) => v.key === "cell/PurchasesMar!C1").value);

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const lines = snapshot.lines.map((line) =>
        line.entryNumber === "TXN-0264" ? { ...line, measurableQuantity: line.measurableQuantity + 500 } : line,
      );
      await window.DiyaGlBooksPage.setLines(lines, "test: edit the mileage claim's quantity");
    });
    await page.waitForFunction(() => window.DIYA_BOOKS_SNAPSHOT.edited === true);

    const after = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.report.values.find((v) => v.key === "cell/PurchasesMar!C1").value);
    expect(Number(after)).toBe(Number(before) + 500);

    const engineFailing = await engineFailingSet(page);
    expect(
      engineFailing.filter((label) => label.startsWith("Purchases: business miles") || label.startsWith("Purchases: mileage claimed")),
    ).toEqual([]);
  });
});
