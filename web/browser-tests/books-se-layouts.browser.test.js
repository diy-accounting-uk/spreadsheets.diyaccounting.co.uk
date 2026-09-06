// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-se-layouts.browser.test.js
//
// The Self Employed page at four viewports: the year, bank, payroll, SA103F
// and VAT views each clean under axe with a loaded book and none of them
// scrolling the page sideways; the journal switch and the account switch
// one tab row on a phone; the VAT return one form per card; and one
// keyboard-only run through load, the journal switch, a bank-line edit, a
// settlement helper and the save menu.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "reports/screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });

// Every axe test below skips by name when @axe-core/playwright is missing,
// rather than silently passing.
let AxeBuilder = null;
try {
  ({ default: AxeBuilder } = await import("@axe-core/playwright"));
} catch {
  AxeBuilder = null;
}
const AXE_INSTALL_HINT = "npm install --save-dev @axe-core/playwright@4.13.0";

const VIEWPORTS = {
  "desktop": { width: 1440, height: 900 },
  "laptop": { width: 1280, height: 800 },
  "tablet": { width: 1024, height: 1366 },
  "mobile-portrait": { width: 390, height: 844 },
};

const VIEWS = ["year", "bank", "payroll", "sa103f", "vat"];
const EXAMPLE = "se-scenario-advanced";
const VAT_QUARTERS = 5;
const TAP_TARGET = 44;

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

function seUrl() {
  return `${baseUrl}/books/se.html`;
}

// A render animates the month detail in, and a click leaves the pointer
// over whatever it pressed, so the page settles and the pointer parks in
// the corner before anything is measured or audited.
async function settle(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
  await page.mouse.move(0, 0);
}

async function openLoadedBook(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(seUrl(), { waitUntil: "domcontentloaded" });
  await page.locator(`[data-example="${EXAMPLE}"]`).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
  await settle(page);
}

async function openView(page, viewId) {
  const tab = page.locator(`.tab-btn[data-view="${viewId}"]`);
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await settle(page);
}

// The page's own scroller and the document: a table wider than the view
// scrolls inside its own box, never either of these.
async function sidewaysOverflow(page) {
  return page.evaluate(() => {
    const body = document.querySelector(".app-body");
    return {
      document: document.documentElement.scrollWidth - window.innerWidth,
      appBody: body.scrollWidth - body.clientWidth,
    };
  });
}

// ── axe, five views at four viewports ────────────────────────────────────

test.describe("DIYA-GL Self Employed page — accessibility per viewport and view", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name}: zero serious or critical axe violations on the five views`, async ({ page }, testInfo) => {
      test.skip(!AxeBuilder, `@axe-core/playwright is not installed. Install it with: ${AXE_INSTALL_HINT}`);

      await openLoadedBook(page, viewport);
      for (const viewId of VIEWS) {
        await openView(page, viewId);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        const seriousOrCritical = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        if (seriousOrCritical.length) {
          await testInfo.attach(`axe-violations-${name}-${viewId}.json`, {
            body: JSON.stringify(seriousOrCritical, null, 2),
            contentType: "application/json",
          });
        }
        expect(
          seriousOrCritical.map((v) => v.id),
          `serious/critical axe violations at ${name} on the ${viewId} view`,
        ).toEqual([]);
      }
    });
  }
});

// ── layout, five views at four viewports ─────────────────────────────────

test.describe("DIYA-GL Self Employed page — layout per viewport", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name}: no view scrolls the page sideways, and the VAT return is one form per card`, async ({ page }) => {
      await openLoadedBook(page, viewport);
      for (const viewId of VIEWS) {
        await openView(page, viewId);
        const overflow = await sidewaysOverflow(page);
        expect(overflow.document, `the document scrolls sideways at ${name} on the ${viewId} view`).toBeLessThanOrEqual(0);
        expect(overflow.appBody, `the app body scrolls sideways at ${name} on the ${viewId} view`).toBeLessThanOrEqual(0);
      }

      const forms = page.locator(".form-render");
      await expect(forms).toHaveCount(VAT_QUARTERS);
      for (let i = 0; i < VAT_QUARTERS; i++) {
        await expect(forms.nth(i).locator(".form-masthead")).toHaveCount(1);
        await expect(forms.nth(i).locator(".form-name")).toHaveText(new RegExp(`^Quarter ${i + 1}`));
      }
    });
  }

  // One row that scrolls, every stop a full tap target, the chosen one
  // marked -- the sheet tab strip's own idiom, inside the month's card and
  // under the bank book's heading.
  async function tabRowGeometry(page, selector) {
    return page.evaluate((sel) => {
      const row = document.querySelector(sel);
      const buttons = Array.from(row.querySelectorAll("button"));
      const tops = buttons.map((button) => Math.round(button.getBoundingClientRect().top));
      return {
        rowHeight: row.getBoundingClientRect().height,
        rowRight: row.getBoundingClientRect().right,
        wraps: new Set(tops).size > 1,
        shortest: Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
        pressed: buttons.filter((button) => button.getAttribute("aria-pressed") === "true").length,
        count: buttons.length,
      };
    }, selector);
  }

  test("mobile portrait: the journal switch and the account switch each sit in one tab row", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["mobile-portrait"]);

    await expect(page.locator(".month-card.is-open")).toHaveCount(1);
    const toggle = page.locator("#entries-toggle");
    if ((await toggle.innerText()).includes("Show entries")) {
      await toggle.click();
      await settle(page);
    }
    const journal = await tabRowGeometry(page, ".month-card.is-open .journal-switch");
    expect(journal.count).toBe(5);
    expect(journal.wraps, "the journal switch wraps onto a second row").toBe(false);
    expect(journal.shortest).toBeGreaterThanOrEqual(TAP_TARGET);
    expect(journal.rowRight).toBeLessThanOrEqual(VIEWPORTS["mobile-portrait"].width);
    expect(journal.pressed).toBe(1);

    await openView(page, "bank");
    const account = await tabRowGeometry(page, ".account-switch");
    expect(account.count).toBe(2);
    expect(account.wraps, "the account switch wraps onto a second row").toBe(false);
    expect(account.shortest).toBeGreaterThanOrEqual(TAP_TARGET);
    expect(account.pressed).toBe(1);
  });
});

// ── keyboard-only run ────────────────────────────────────────────────────

// A journal switch or a settlement replaces the view's innerHTML, which
// drops focus back to <body>; an amount commit is the one edit that
// restores focus to the input it left. tabTo() re-walks from wherever
// focus has landed, backward when the stop sits earlier in the document
// than the current one.
async function tabTo(page, selector, { maxTabs = 120, backward = false } = {}) {
  for (let i = 0; i < maxTabs; i++) {
    const matched = await page.evaluate((sel) => {
      const el = document.activeElement;
      return !!el && el !== document.body && el.matches(sel);
    }, selector);
    if (matched) return;
    await page.keyboard.press(backward ? "Shift+Tab" : "Tab");
  }
  throw new Error(`keyboard Tab did not reach "${selector}" within ${maxTabs} presses`);
}

async function activeElementHasFocusRing(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const style = getComputedStyle(el);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  });
}

async function lineCount(page) {
  return page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.lines.length);
}

test.describe("DIYA-GL Self Employed page — keyboard-only run", () => {
  test("load, switch to the bank journal, edit a bank line, apply a settlement and open the save menu, keyboard only", async ({ page }) => {
    const focusRingSamples = [];

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(seUrl(), { waitUntil: "domcontentloaded" });

    // Load: the example button.
    await tabTo(page, `[data-example="${EXAMPLE}"]`);
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    await expect(page.locator('.year-row[data-month="2025-04"]')).toHaveAttribute("aria-expanded", "true");

    if ((await page.locator("table.entries-table").count()) === 0) {
      await tabTo(page, "#entries-toggle");
      await page.keyboard.press("Enter");
    }
    await expect(page.locator("table.entries-table")).toHaveCount(1);

    // The journal switch: the bank journal's table replaces the sales one.
    await tabTo(page, '[data-journal-switch="bank"]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator('table.entries-table[data-journal="bank"]')).toBeVisible();

    // A bank-line edit: select the first bank amount, add a hundred pounds,
    // commit with Enter. The commit re-renders and hands focus back to the
    // input, and the undo control appears for the change.
    await tabTo(page, 'table.entries-table[data-journal="bank"] [data-amount-entry]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    const entryNumber = await page.evaluate(() => document.activeElement.getAttribute("data-amount-entry"));
    const input = page.locator(`[data-amount-entry="${entryNumber}"]`);
    const originalValue = await input.inputValue();
    const newAmount = (Number(originalValue) + 100).toFixed(2);

    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.keyboard.type(newAmount);
    await page.keyboard.press("Enter");

    await expect(page.locator("#undo-btn")).toBeVisible();
    await expect(input).toHaveValue(newAmount);
    await expect
      .poll(() => page.evaluate((n) => document.activeElement && document.activeElement.getAttribute("data-amount-entry"), entryNumber))
      .toBe(entryNumber);

    // A settlement helper: back to the bank book's tab, then the first
    // preview, then its apply control.
    await tabTo(page, '.tab-btn[data-view="bank"]', { backward: true });
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator(".settlement-list")).toBeAttached();

    await tabTo(page, "[data-settlement-preview]");
    focusRingSamples.push(await activeElementHasFocusRing(page));
    const settlementId = await page.evaluate(() => document.activeElement.getAttribute("data-settlement-preview"));
    await page.keyboard.press("Enter");
    await expect(page.locator(`[data-settlement-apply="${settlementId}"]`)).toBeVisible();

    const before = await lineCount(page);
    await tabTo(page, `[data-settlement-apply="${settlementId}"]`);
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator("#toast")).toContainText("Added the missing half of " + settlementId);
    await expect.poll(() => lineCount(page)).toBe(before + 1);
    await expect(page.locator(`[data-settlement-preview="${settlementId}"]`)).toHaveCount(0);

    // Save: the topbar's control opens the three-download menu.
    await tabTo(page, "#save-btn", { backward: true });
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    const saveMenu = page.locator("#save-menu");
    await expect(saveMenu).toBeVisible();
    await expect(saveMenu.locator('[role="menuitem"]')).toHaveCount(3);
    await page.keyboard.press("Escape");

    expect(focusRingSamples.length).toBe(7);
    for (const [i, hasRing] of focusRingSamples.entries()) {
      expect(hasRing, `focus stop #${i + 1} carries no visible focus ring`).toBe(true);
    }
  });
});

// ── screenshots, one per viewport ────────────────────────────────────────

test.describe("DIYA-GL Self Employed page — layout screenshots", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name}: screenshot of a loaded book`, async ({ page }) => {
      await openLoadedBook(page, viewport);
      await page.screenshot({ path: path.join(screenshotsDir, `se-layouts-${name}.png`), fullPage: false });
    });
  }
});
