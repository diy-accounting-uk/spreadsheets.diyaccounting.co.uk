// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-taxi-layouts.browser.test.js
//
// E6 from PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md's test approach: the four layout
// viewports, each clean under axe with a loaded book, plus one keyboard-only
// traversal through year, month, week, day, add a fare, save -- Taxi's own
// deeper drill than BST's flat entries grid.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "reports/screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });

// @axe-core/playwright is a devDependency the batch has not installed yet
// (no network installs from a worktree sub-agent). Every axe test below
// skips by name when it is missing, rather than silently passing.
let AxeBuilder = null;
try {
  ({ default: AxeBuilder } = await import("@axe-core/playwright"));
} catch {
  AxeBuilder = null;
}
const AXE_INSTALL_HINT = "npm install --save-dev @axe-core/playwright@4.13.0";

const VIEWPORTS = {
  "desktop-landscape": { width: 1440, height: 900 },
  "desktop-portrait": { width: 1024, height: 1366 },
  "mobile-landscape": { width: 844, height: 390 },
  "mobile-portrait": { width: 390, height: 844 },
};

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

function taxiUrl() {
  return `${baseUrl}/books/taxi.html`;
}

async function openLoadedBook(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(taxiUrl(), { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /taxi-scenario-basic/ }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

// ── E6a: axe, one loaded book per viewport ──────────────────────────────

test.describe("DIYA-GL Taxi books page — accessibility per viewport (E6)", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name}: zero serious or critical axe violations`, async ({ page }, testInfo) => {
      test.skip(!AxeBuilder, `@axe-core/playwright is not installed. Install it with: ${AXE_INSTALL_HINT}`);

      await openLoadedBook(page, viewport);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

      const seriousOrCritical = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      if (seriousOrCritical.length) {
        await testInfo.attach(`axe-violations-${name}.json`, {
          body: JSON.stringify(seriousOrCritical, null, 2),
          contentType: "application/json",
        });
      }
      expect(
        seriousOrCritical.map((v) => v.id),
        `serious/critical axe violations at ${name}`,
      ).toEqual([]);
    });
  }
});

// ── E6b: keyboard-only traversal ────────────────────────────────────────
//
// Taxi's own year -> month -> week -> day drill goes one level deeper than
// BST's flat entries grid, so this walk adds a week-row stop and a day's
// "Add a fare" stop before reaching the same amount-commit and save-menu
// stops books-layouts.browser.test.js proves for BST.

async function tabTo(page, selector, { maxTabs = 100, backward = false } = {}) {
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

test.describe("DIYA-GL Taxi books page — keyboard-only traversal (E6)", () => {
  test("year, month, week, day, add a fare, save -- keyboard only", async ({ page }) => {
    const focusRingSamples = [];

    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(taxiUrl(), { waitUntil: "domcontentloaded" });

    // Stop 0: the account button -- cloud sign-in is live on this server, so
    // the topbar now carries it ahead of Checks/Undo/New/Save.
    await tabTo(page, "#account-btn");
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await expect(page.getByRole("button", { name: "Sign in to save to your account" })).toBeFocused();

    // Stop 1: the example button.
    await tabTo(page, '[data-example="taxi-scenario-basic"]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    // Stop 2: June's year row.
    const juneRow = page.locator('.year-row[data-month="2025-06"]');
    await tabTo(page, '.year-row[data-month="2025-06"]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(juneRow).toHaveAttribute("aria-expanded", "true");

    // Stop 3: the week of 9 June, a full mid-year week.
    const weekRow = page.locator('tr.week-row[data-week="2025-06-09"]');
    await tabTo(page, 'tr.week-row[data-week="2025-06-09"]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(weekRow).toHaveAttribute("aria-expanded", "true");

    // Stop 4: 11 June's "Add a fare" control.
    const dayTotalBefore = await page.locator('tr.day-row[data-day="2025-06-11"] td.num').first().innerText();
    await tabTo(page, '[data-add-fare="2025-06-11"]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");

    // Stop 5: the draft's amount field, filled and committed by keyboard.
    await tabTo(page, '[data-draft-field="amount"]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.type("45");
    await page.keyboard.press("Enter");
    await expect(page.locator("#toast")).toContainText("Added a fare of £45.00");
    await expect.poll(async () => page.locator('tr.day-row[data-day="2025-06-11"] td.num').first().innerText()).not.toBe(dayTotalBefore);

    // Stop 6: the save control opens its menu. The draft commit restored
    // focus inside the day grid, later in the document than the topbar, so
    // this stop walks backward to it.
    await tabTo(page, "#save-btn", { backward: true });
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    const saveMenu = page.locator("#save-menu");
    await expect(saveMenu).toBeVisible();
    await expect(saveMenu.locator('[role="menuitem"]')).toHaveCount(3);
    await expect(saveMenu.getByRole("menuitem", { name: "Save to my account", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    expect(focusRingSamples.length).toBeGreaterThanOrEqual(7);
    for (const [i, hasRing] of focusRingSamples.entries()) {
      expect(hasRing, `focus stop #${i + 1} carries no visible focus ring`).toBe(true);
    }
  });
});

// ── Screenshots, one per viewport, alongside the axe run ────────────────

test.describe("DIYA-GL Taxi books page — layout screenshots (E6)", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name}: screenshot of a loaded book`, async ({ page }) => {
      await openLoadedBook(page, viewport);
      await page.screenshot({ path: path.join(screenshotsDir, `taxi-layouts-${name}.png`), fullPage: false });
    });
  }
});
