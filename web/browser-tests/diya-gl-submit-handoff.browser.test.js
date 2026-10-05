// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-submit-handoff.browser.test.js
//
// "File with DIY Accounting Submit" in the Save menu: offered only where the product's manifest
// and the book allow a filing, derives the figures in the browser, and opens Submit's filing
// page with them in the URL fragment.

import { test, expect } from "@playwright/test";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/diya-gl.co.uk/public");
const SUBMIT_ORIGIN = "https://submit.test.invalid";

let closeServer;
let baseUrl;

test.beforeAll(async () => {
  const server = await startStaticServer(publicDir, path.join(process.cwd(), "infra/main/resources/diya-gl-security-headers.json"));
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer();
});

async function openBook(page, product, example) {
  await page.addInitScript((origin) => {
    window.DIYA_GL_SUBMIT_TEST_ORIGIN = origin;
    window.__opened = [];
    window.open = (url) => {
      window.__opened.push(url);
      return null;
    };
  }, SUBMIT_ORIGIN);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/${product}.html?example=${example}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function openSaveMenu(page) {
  await page.locator("#save-btn, #save-btn-mobile").first().click();
  await expect(page.locator("#save-menu")).toBeVisible();
}

function decodeFragment(url) {
  const hash = new URL(url).hash;
  expect(hash.startsWith("#books=")).toBe(true);
  const base64 = hash.slice("#books=".length).replace(/-/g, "+").replace(/_/g, "/");
  const binary = Buffer.from(base64, "base64").toString("utf-8");
  return JSON.parse(binary);
}

test.describe("DIYA-GL books: file with DIY Accounting Submit", () => {
  test("a self employed book offers the quarterly update and opens Submit's period page with the figures", async ({ page }) => {
    await openBook(page, "se", "se-brickwork-pro-vat");
    await openSaveMenu(page);
    await page.getByRole("menuitem", { name: "File with DIY Accounting Submit" }).click();
    await expect(page.locator("#submit-handoff")).toBeVisible();
    await page.locator("#submit-handoff-kind").selectOption("itsa-quarterly");
    await expect(page.locator("#submit-handoff-go")).toBeEnabled({ timeout: 30_000 });
    await page.locator("#submit-handoff-go").click();
    await expect(page.locator("#submit-handoff")).toHaveCount(0);

    const opened = await page.evaluate(() => window.__opened);
    expect(opened).toHaveLength(1);
    expect(opened[0].startsWith(`${SUBMIT_ORIGIN}/hmrc/itsa/selfEmploymentPeriod.html#books=`)).toBe(true);
    const sent = decodeFragment(opened[0]);
    expect(sent.kind).toBe("itsa-quarterly");
    expect(sent.period.taxYear).toMatch(/^\d{4}-\d{2}$/);
    expect(Object.keys(sent.figures).sort()).toEqual(["periodDisallowableExpenses", "periodExpenses", "periodIncome"]);
    expect(sent.packageVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("a VAT registered company book offers a VAT return for a period end date", async ({ page }) => {
    await openBook(page, "ltd", "ltd-brickwork-pro-vat");
    await openSaveMenu(page);
    await page.getByRole("menuitem", { name: "File with DIY Accounting Submit" }).click();
    await expect(page.locator("#submit-handoff-period-date")).toBeVisible({ timeout: 30_000 });
    await page.locator("#submit-handoff-period-date").fill("2025-12-31");
    await page.locator("#submit-handoff-go").click();
    await expect(page.locator("#submit-handoff")).toHaveCount(0, { timeout: 30_000 });

    const opened = await page.evaluate(() => window.__opened);
    expect(opened).toHaveLength(1);
    expect(opened[0].startsWith(`${SUBMIT_ORIGIN}/hmrc/vat/submitVat.html#books=`)).toBe(true);
    const sent = decodeFragment(opened[0]);
    expect(sent.kind).toBe("vat");
    expect(sent.period.periodEnd).toBe("2025-12-31");
    expect(Object.keys(sent.figures)).toHaveLength(7);
  });

  test("a company book that is not VAT registered offers no filing", async ({ page }) => {
    await openBook(page, "ltd", "ltd-brickwork-pro-nonvat");
    await openSaveMenu(page);
    await expect(page.getByRole("menuitem", { name: "File with DIY Accounting Submit" })).toHaveCount(0);
  });

  test("a Basic Sole Trader book offers no filing", async ({ page }) => {
    await openBook(page, "bst", "bst-scenario-basic");
    await openSaveMenu(page);
    await expect(page.getByRole("menuitem", { name: "File with DIY Accounting Submit" })).toHaveCount(0);
  });
});
