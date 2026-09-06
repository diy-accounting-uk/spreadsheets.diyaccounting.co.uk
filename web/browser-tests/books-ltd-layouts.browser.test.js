// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-ltd-layouts.browser.test.js
//
// LT-T14 from PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md's test approach: the four
// layout viewports, each clean under axe with the CT600 view open and the
// Bank view open on ltd-scenario-full, a keyboard-only traversal through a
// payroll figure edit and a Bank view settlement helper to the save menu,
// and the CT600 form's two financial-year groups stacking at mobile
// portrait. Follows books-layouts.browser.test.js's shape (BST's own E6).

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

function ltdUrl() {
  return `${baseUrl}/books/ltd.html`;
}

async function openLoadedBook(page, viewport, viewId) {
  await page.setViewportSize(viewport);
  await page.goto(ltdUrl(), { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /ltd-scenario-full/ }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
  if (viewId) {
    await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
    await expect(page.locator(`.tab-btn[data-view="${viewId}"]`)).toHaveAttribute("aria-selected", "true");
  }
}

// ── axe, one loaded book per viewport, with the CT600 view and the Bank view each open ──

const AXE_VIEWS = ["ct600", "bank"];

test.describe("DIYA-GL Ltd books page — accessibility per viewport (LT-T14)", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    for (const viewId of AXE_VIEWS) {
      test(`${name}: zero serious or critical axe violations (${viewId} view)`, async ({ page }, testInfo) => {
        test.skip(!AxeBuilder, `@axe-core/playwright is not installed. Install it with: ${AXE_INSTALL_HINT}`);

        await openLoadedBook(page, viewport, viewId);
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
          `serious/critical axe violations at ${name} (${viewId} view)`,
        ).toEqual([]);
      });
    }
  }
});

// ── the CT600 form's two financial-year groups ──────────────────────────

test.describe("DIYA-GL Ltd books page — CT600 layout (LT-T14)", () => {
  test("the two financial-year rows stack at mobile portrait, box 380's group below box 330's", async ({ page }) => {
    await openLoadedBook(page, VIEWPORTS["mobile-portrait"], "ct600");

    const firstGroup = page
      .locator(".fy-group")
      .filter({ has: page.locator(".fy-caption", { hasText: "First financial year" }) })
      .first();
    const secondGroup = page
      .locator(".fy-group")
      .filter({ has: page.locator(".fy-caption", { hasText: "Second financial year" }) })
      .first();
    await expect(firstGroup).toBeVisible();
    await expect(secondGroup).toBeVisible();

    const firstBox = await firstGroup.boundingBox();
    const secondBox = await secondGroup.boundingBox();
    expect(firstBox, "box 330's financial-year group has a layout box").not.toBeNull();
    expect(secondBox, "box 380's financial-year group has a layout box").not.toBeNull();
    expect(secondBox.y, "box 380's group sits below box 330's, not beside it").toBeGreaterThanOrEqual(firstBox.y + firstBox.height);
  });
});

// ── keyboard-only traversal ────────────────────────────────────────────

// A month or entries toggle replaces the view's own innerHTML (render(),
// shell.js), which drops keyboard focus back to <body> -- the same thing a
// real browser does when the focused element leaves the document. An amount
// commit is the one edit that restores focus itself (restoreEditFocus()), to
// the very input just edited. tabTo() re-walks from wherever focus has
// landed rather than assuming a fixed number of stops survives either case;
// backward walks with Shift+Tab when the next stop sits earlier in the
// document than the current one, as the sheet tabs do once focus has moved
// on into the entries grid.
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

test.describe("DIYA-GL Ltd books page — keyboard-only traversal (LT-T14)", () => {
  test("load, edit a payroll figure, switch to the Bank view, apply a helper, and open the save menu, keyboard only", async ({ page }) => {
    // Real Tab presses, not shortcuts: with fifteen views and the headline
    // strip's pie-chart legend on every one (both add tab stops absent from
    // BST's own four-view page), this run is genuinely several hundred key
    // presses long, and video/trace capture add real per-action overhead.
    test.setTimeout(240_000);
    const focusRingSamples = [];

    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(ltdUrl(), { waitUntil: "domcontentloaded" });

    // Stop 1: the example button. Loading a book always lands on the Year
    // view (shell.js's applyLoadedSnapshot sets state.view = "year"), so
    // there is no separate stop needed to reach it.
    await tabTo(page, '[data-example="ltd-scenario-full"]');
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

    // Stop 3: the entries toggle, to reveal the journal switch and the
    // month's posted lines.
    await tabTo(page, "#entries-toggle");
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator(".journal-switch")).toBeVisible();

    // Stop 4: the Payroll journal -- one of Ltd's four (Sales, Purchases,
    // Bank, Payroll share one grid; the switch shows one at a time once
    // there are more than two).
    await tabTo(page, '[data-journal-switch="payroll"]');
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator('table.entries-table[data-journal="payroll"]')).toBeVisible();

    // Stop 5: the first payroll amount input -- select its text, type a new
    // amount, commit with Enter (blur -> change), and read the year table's
    // Total Admin Expenses column's own movement (CELL_MAP's MnthP&L!B41).
    const totalExpenses = page.locator('.year-totals [data-r-key*="MnthP&L!B41"]').first();
    const beforeText = (await totalExpenses.textContent()).trim();
    const before = Number(beforeText.replace(/[£,]/g, ""));

    await tabTo(page, "[data-amount-entry]");
    focusRingSamples.push(await activeElementHasFocusRing(page));
    const entryNumber = await activeElementAttr(page, "data-amount-entry");
    const originalValue = await page.locator(`[data-amount-entry="${entryNumber}"]`).inputValue();
    const newAmount = (Number(originalValue) + 100).toFixed(2);

    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.keyboard.type(newAmount);
    await page.keyboard.press("Enter");

    await expect(page.locator("#toast")).toContainText("Changed " + entryNumber);
    await expect
      .poll(async () => (await totalExpenses.textContent()).trim(), { message: "Total Admin Expenses after the payroll edit" })
      .not.toBe(beforeText);
    const afterText = (await totalExpenses.textContent()).trim();
    const after = Number(afterText.replace(/[£,]/g, ""));
    // Employer's NI moves with gross pay on its own banded formula, so the
    // rise need not equal the £100 raise exactly -- only its direction is
    // asserted: a larger wage never lowers admin expenses.
    expect(after, "a larger payroll figure raises Total Admin Expenses, never lowers it").toBeGreaterThan(before);

    // Stop 6: the Bank tab -- earlier in the document than the amount input
    // the payroll commit restored focus to, so this stop walks backward.
    await tabTo(page, '.tab-btn[data-view="bank"]', { backward: true });
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator('.tab-btn[data-view="bank"]')).toHaveAttribute("aria-selected", "true");

    // Stop 7: a settlement's own helper -- Preview reveals the missing half
    // it would add.
    await tabTo(page, "[data-settlement-preview]");
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-settlement-apply]").first()).toBeVisible();

    // Stop 8: Apply, which commits the missing half.
    await tabTo(page, "[data-settlement-apply]");
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    await expect(page.locator("#toast")).toContainText("Added the missing half");

    // Stop 9: the save control opens its menu. The settlement commit reset
    // focus to the document body (no focusEntry to restore, unlike an
    // amount edit), so this stop walks forward from the top of the page.
    await tabTo(page, "#save-btn");
    focusRingSamples.push(await activeElementHasFocusRing(page));
    await page.keyboard.press("Enter");
    const saveMenu = page.locator("#save-menu");
    await expect(saveMenu).toBeVisible();
    // Ltd is a several-file package (save.singleFile: false), so the menu
    // carries three downloads rather than a single-workbook one.
    await expect(saveMenu.locator('[role="menuitem"]')).toHaveCount(3);
    await page.keyboard.press("Escape");

    expect(focusRingSamples.length).toBeGreaterThanOrEqual(5);
    for (const [i, hasRing] of focusRingSamples.entries()) {
      expect(hasRing, `focus stop #${i + 1} carries no visible focus ring`).toBe(true);
    }
  });
});

// ── Screenshots, one per viewport, alongside the axe run ────────────────

test.describe("DIYA-GL Ltd books page — layout screenshots (LT-T14)", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name}: screenshot of a loaded book`, async ({ page }) => {
      await openLoadedBook(page, viewport);
      await page.screenshot({ path: path.join(screenshotsDir, `ltd-layouts-${name}.png`), fullPage: false });
    });
  }
});
