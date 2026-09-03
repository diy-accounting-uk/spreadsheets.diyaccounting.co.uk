// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-layouts.browser.test.js
//
// E6 from PLAN_DIYA_GL_BST_CLI_MCP_WEB.md's test approach: the four layout
// viewports, each clean under axe with a loaded book, plus one keyboard-only
// traversal through load, drill, edit and save.

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

function bstUrl() {
  return `${baseUrl}/books/bst.html`;
}

async function openLoadedBook(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

// ── E6a: axe, one loaded book per viewport ──────────────────────────────

test.describe("DIYA-GL books page — accessibility per viewport (E6)", () => {
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

// A month or entries toggle replaces the view's own innerHTML (render(),
// bst.js), which drops keyboard focus back to <body> -- the same thing a
// real browser does when the focused element leaves the document. An amount
// commit is the one edit that restores focus itself (restoreEditFocus()), to
// the very input just edited. tabTo() re-walks from wherever focus has
// landed rather than assuming a fixed number of stops survives either case;
// backward walks with Shift+Tab when the next stop sits earlier in the
// document than the current one, as the topbar's save control does once
// focus has moved on into the entries grid.
async function tabTo(page, selector, { maxTabs = 80, backward = false } = {}) {
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

async function activeElementAttr(page, attr) {
  return page.evaluate((a) => document.activeElement && document.activeElement.getAttribute(a), attr);
}

test.describe("DIYA-GL books page — keyboard-only traversal (E6)", () => {
  test("load, drill into a month, edit an amount, and open the save menu, keyboard only", async ({ page }) => {
    const focusRingSamples = [];

    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    // Stop 1: the example button.
    await tabTo(page, '[data-example="bst-scenario-basic"]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    // Stop 2: April's year row -- open by default, so the first Enter
    // closes it and proves the toggle answers the keyboard the same as a
    // click; a second pass reopens it for the steps that follow.
    const aprilRow = page.locator('.year-row[data-month="2025-04"]');
    await expect(aprilRow).toHaveAttribute("aria-expanded", "true");
    await tabTo(page, '.year-row[data-month="2025-04"]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(aprilRow).toHaveAttribute("aria-expanded", "false");

    await tabTo(page, '.year-row[data-month="2025-04"]');
    await page.keyboard.press("Enter");
    await expect(aprilRow).toHaveAttribute("aria-expanded", "true");

    // Stop 3: the entries toggle, to reveal the amount inputs.
    await tabTo(page, "#entries-toggle");
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator("table.entries-table")).toHaveCount(2); // Sales and Purchases, side by side

    // Stop 4: the first amount input -- select its text, type a new
    // amount, commit with Enter, and read the year total's own movement.
    const yearTotal = page.locator("tfoot.year-totals td").first();
    const beforeText = (await yearTotal.textContent()).trim();
    const before = Number(beforeText.replace(/[£,]/g, ""));

    await tabTo(page, "[data-amount-entry]");
    focusRingSamples.push(await activeElementHasFocusRing(page));
    const entryNumber = await activeElementAttr(page, "data-amount-entry");
    const originalValue = await page.locator(`[data-amount-entry="${entryNumber}"]`).inputValue();
    // A whole-pound change: the Sales Turnover column this locator most
    // often lands on rounds its monthly total to the nearest pound, the
    // same way the template's own Monthly Sales row does, so a fractional
    // delta would not move the year total by the same fraction it names.
    const newAmount = (Number(originalValue) + 100).toFixed(2);

    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.keyboard.type(newAmount);
    await page.keyboard.press("Enter");

    await expect
      .poll(async () => (await yearTotal.textContent()).trim(), { message: "year total after the keyboard edit" })
      .not.toBe(beforeText);
    const afterText = (await yearTotal.textContent()).trim();
    const after = Number(afterText.replace(/[£,]/g, ""));
    expect(Math.round((after - before) * 100) / 100).toBeCloseTo(Number(newAmount) - Number(originalValue), 2);

    // A [data-helper-preview] control exists only beside a failing check;
    // bst-scenario-basic's checks all pass, so there is none to reach.
    const helperCount = await page.locator("[data-helper-preview]").count();
    if (helperCount > 0) {
      await tabTo(page, "[data-helper-preview]");
      focusRingSamples.push(await activeElementHasFocusRing(page));
    } else {
      console.log("E6 keyboard traversal: no [data-helper-preview] control is present (every check passes); step skipped.");
    }

    // Stop 5: the save control opens its menu. The amount commit restored
    // focus inside the entries grid, later in the document than the topbar,
    // so this stop walks backward to it.
    await tabTo(page, "#save-btn", { backward: true });
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    const saveMenu = page.locator("#save-menu");
    await expect(saveMenu).toBeVisible();
    await expect(saveMenu.locator('[role="menuitem"]')).toHaveCount(2);
    await page.keyboard.press("Escape");

    expect(focusRingSamples.length).toBeGreaterThanOrEqual(5);
    for (const [i, hasRing] of focusRingSamples.entries()) {
      expect(hasRing, `focus stop #${i + 1} carries no visible focus ring`).toBe(true);
    }
  });
});

// ── Screenshots, one per viewport, alongside the axe run ────────────────

test.describe("DIYA-GL books page — layout screenshots (E6)", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name}: screenshot of a loaded book`, async ({ page }) => {
      await openLoadedBook(page, viewport);
      await page.screenshot({ path: path.join(screenshotsDir, `books-layouts-${name}.png`), fullPage: false });
    });
  }
});
