// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-taxi-takings.browser.test.js
//
// Three takings-view cases from PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md's T14 brief
// that the equivalence, formats, edits and layouts specs do not cover: undo
// after a fare edit, the mobile-portrait week and day cards, and a fare's
// name and miles committed through changeLineDetail and changeLineQuantity
// with the caret returned to the field.
//
// Every starting figure is anchored to the fixture line it comes from, not
// read back from the page alone, so a check that the page never actually
// wrote the edit cannot pass by comparing a value to itself.

import { test, expect } from "@playwright/test";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const PUBLIC_DIR = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");

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

async function openBook(page, example, viewport) {
  await page.setViewportSize(viewport || { width: 1440, height: 900 });
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

// The day's own takings, read off the snapshot's own grouped structure
// (taxi.js: groupTakings) rather than the DOM -- a day with one fare renders
// its amount in an input and a day with two renders it as plain text, and a
// selector chasing both shapes is more fragile than reading the same figure
// the page itself renders from.
async function dayTakings(page, date) {
  return page.evaluate((date) => {
    for (const month of Object.values(window.DIYA_BOOKS_SNAPSHOT.takings.months)) {
      for (const week of month.weeks) {
        const day = week.days.find((d) => d.date === date);
        if (day) return day.takings;
      }
    }
    return null;
  }, date);
}

async function lineCount(page) {
  return page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.lines.length);
}

// ── undo after a fare edit ──────────────────────────────────────────────
//
// 2025-06-11 (TXN-0045, a Wednesday, £200.00 in examples/basic-taxi-driver)
// carries one fare and nothing else that day, so its own takings figure is
// the fixture's line amount, not a derived sum a bug could accidentally
// still agree with.

test.describe("DIYA-GL Taxi books page — undo after a fare edit", () => {
  test("undo restores the day's sum and the book's line count, by button and by keyboard", async ({ page }) => {
    await openBook(page, /taxi-scenario-basic/);
    await openMonth(page, "2025-06");
    await openWeek(page, "2025-06-09");

    const dayBefore = await dayTakings(page, "2025-06-11");
    expect(dayBefore).toBe(200);
    const linesBefore = await lineCount(page);
    await expect(page.locator("#undo-btn")).toHaveClass(/hidden/);

    await addFareViaUI(page, "2025-06-11", { amount: 45, detail: "Undo me" });
    await expect(page.locator("#toast")).toContainText("Added a fare of £45.00");
    await expect.poll(() => dayTakings(page, "2025-06-11")).toBe(245);
    expect(await lineCount(page)).toBe(linesBefore + 1);
    await expect(page.locator("#undo-btn")).not.toHaveClass(/hidden/);

    await page.locator("#undo-btn").click();
    await expect(page.locator("#undo-btn")).toHaveClass(/hidden/);
    await expect.poll(() => dayTakings(page, "2025-06-11")).toBe(200);
    expect(await lineCount(page)).toBe(linesBefore);

    // The same shape again through the keyboard, so the shortcut is not a
    // second path that only looks like the button.
    await addFareViaUI(page, "2025-06-11", { amount: 30, detail: "Undo me by keyboard" });
    await expect.poll(() => dayTakings(page, "2025-06-11")).toBe(230);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator("#undo-btn")).toHaveClass(/hidden/);
    await expect.poll(() => dayTakings(page, "2025-06-11")).toBe(200);
    expect(await lineCount(page)).toBe(linesBefore);
  });
});

// ── mobile portrait: week cards opening to day cards ───────────────────
//
// 2025-04-08 (TXN-0004, a Tuesday, £220.00) carries one fare, so its card
// exposes the fare's own amount field once opened, the same figure April's
// month card's "Takings" reads.

async function openMonthCard(page, monthKey) {
  const head = page.locator(`[data-month-card="${monthKey}"] .month-card-head`);
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
}

async function openWeekCard(page, weekStart) {
  const head = page.locator(`.week-card[data-week-card="${weekStart}"] .week-card-head`);
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
}

async function openDayCard(page, date) {
  const head = page.locator(`.day-card[data-day-card="${date}"] .day-card-head`);
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
}

test.describe("DIYA-GL Taxi books page — mobile portrait takings cards", () => {
  test("week cards open to day cards, and an edit inside a fare card moves the month card's Takings figure", async ({ page }) => {
    await openBook(page, /taxi-scenario-basic/, { width: 390, height: 844 });

    await openMonthCard(page, "2025-04");
    const aprilCard = page.locator('[data-month-card="2025-04"]');
    await expect(aprilCard.locator(".week-cards")).toBeVisible();

    await openWeekCard(page, "2025-04-07");
    const weekCard = page.locator('.week-card[data-week-card="2025-04-07"]');
    await expect(weekCard.locator(".day-list")).toBeVisible();

    const dayCard = weekCard.locator('.day-card[data-day-card="2025-04-08"]');
    await expect(dayCard).toHaveAttribute("data-lines", "1");
    await openDayCard(page, "2025-04-08");
    const fareCard = dayCard.locator('.fare-card[data-entry="TXN-0004"]');
    await expect(fareCard).toBeVisible();

    const amountInput = fareCard.locator("[data-amount-entry]");
    expect(await amountInput.inputValue()).toBe("220.00");

    const takingsFigure = aprilCard.locator(".month-card-figures .figure-value").first();
    const before = Number((await takingsFigure.innerText()).replace(/[£,]/g, ""));

    await amountInput.fill("250.00");
    await amountInput.press("Enter");

    await expect.poll(async () => Number((await takingsFigure.innerText()).replace(/[£,]/g, ""))).toBe(before + 30);
  });
});

// ── changeLineDetail and changeLineQuantity through the page DOM ───────
//
// 2025-06-12 (TXN-0046, £200.00) carries one fare and no miles at the
// start -- examples/basic-taxi-driver carries no miles anywhere -- so
// typing 50 is a real change, not a no-op the check could pass on by luck.

test.describe("DIYA-GL Taxi books page — a fare's name and miles commit through the page DOM", () => {
  test("a typed name commits through changeLineDetail and a typed mileage through changeLineQuantity, with focus returned to the field", async ({
    page,
  }) => {
    await openBook(page, /taxi-scenario-basic/);
    await openMonth(page, "2025-06");
    await openWeek(page, "2025-06-09");

    const detailInput = page.locator('[data-detail-entry="TXN-0046"]');
    expect(await detailInput.inputValue()).toBe("Daily fares");
    await detailInput.fill("Airport transfer");
    await detailInput.press("Enter");
    await expect(page.locator("#toast")).toContainText("Renamed TXN-0046.");
    expect(await page.locator('[data-detail-entry="TXN-0046"]').inputValue()).toBe("Airport transfer");
    expect(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-detail-entry"))).toBe("TXN-0046");

    const milesInput = page.locator('[data-miles-entry="TXN-0046"]');
    expect(await milesInput.inputValue()).toBe("");
    await milesInput.fill("50");
    await milesInput.press("Enter");
    await expect(page.locator("#toast")).toContainText("50 miles");
    expect(await page.locator('[data-miles-entry="TXN-0046"]').inputValue()).toBe("50");
    expect(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-miles-entry"))).toBe("TXN-0046");

    // The book carried no miles anywhere before this edit, so adding 50 here
    // also flags every other fare day in the week as missing miles; the
    // week's own Miles figure still leads the cell, ahead of that flag.
    const weekMilesCell = page.locator('tr.week-row[data-week="2025-06-09"] td.num').nth(4);
    const weekMilesText = await weekMilesCell.innerText();
    expect(weekMilesText.trim().split(/\s+/)[0]).toBe("50");
  });
});
