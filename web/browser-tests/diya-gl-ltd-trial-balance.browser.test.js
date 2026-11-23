// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-ltd-trial-balance.browser.test.js
//
// The Company books page's Trial balance view: the debit and credit totals
// shown equal each other in the year, a month and a VAT quarter, an
// account's lines open on demand and add up to its balance, and the view
// stays inside the viewport on a phone.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/diya-gl.co.uk/public");
const ROOT = process.cwd();
const LTD_FULL_DIR = "examples/precision-code-ltd/full";

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

async function diyaGlZipOf(bookDir) {
  const zip = new JSZip();
  zip.file("book.toml", fs.readFileSync(path.join(ROOT, bookDir, "book.toml")));
  zip.file("lines.jsonl", fs.readFileSync(path.join(ROOT, bookDir, "lines.jsonl")));
  zip.file("report.json", "{}\n");
  return zip.generateAsync({ type: "nodebuffer" });
}

async function dropFile(page, bytes, name) {
  const base64 = bytes.toString("base64");
  await page.evaluate(
    ({ base64, name }) => {
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const file = new File([array], name, { type: "application/zip" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const target = document.querySelector(".empty-state") || document.body;
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { base64, name },
  );
}

async function openTrialBalance(page, viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/ltd.html`, { waitUntil: "domcontentloaded" });
  await dropFile(page, await diyaGlZipOf(LTD_FULL_DIR), "precision-code-ltd-full.zip");
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
  await page.locator('.tab-btn[data-view="trial-balance"], #mobile-tabbar [data-view="trial-balance"]').first().click();
  await expect(page.locator("#trial-balance-table")).toBeVisible();
}

const money = (text) => Number(String(text).replace(/[£,\s]/g, "") || 0);

async function totals(page) {
  return {
    debit: money(await page.locator("#trial-balance-total-debit").innerText()),
    credit: money(await page.locator("#trial-balance-total-credit").innerText()),
  };
}

async function rowSums(page) {
  const cells = await page.$$eval("#trial-balance-table tbody tr", (rows) =>
    rows.map((row) => [row.children[2].textContent, row.children[3].textContent]),
  );
  const read = (text) => Number(String(text).replace(/[£,\s]/g, "") || 0);
  return { debit: cells.reduce((sum, [d]) => sum + read(d), 0), credit: cells.reduce((sum, [, c]) => sum + read(c), 0) };
}

test.describe("DIYA-GL Ltd page: the Trial balance view", () => {
  test("shows equal debit and credit totals for the year, a month and a VAT quarter", async ({ page }) => {
    test.setTimeout(120_000);
    await openTrialBalance(page);
    const picker = page.locator("#trial-balance-period");
    const options = await picker.locator("option").evaluateAll((nodes) => nodes.map((node) => node.value));
    expect(options[0]).toBe("year");
    expect(options.filter((value) => value.startsWith("month:"))).toHaveLength(12);
    expect(options.filter((value) => value.startsWith("vatQuarter:")).length).toBeGreaterThanOrEqual(12);

    for (const value of ["year", options.find((v) => v.startsWith("month:")), options.find((v) => v.startsWith("vatQuarter:"))]) {
      await picker.selectOption(value);
      await expect(page.locator("#trial-balance-period")).toHaveValue(value);
      const shown = await totals(page);
      expect(shown.debit, `${value} has a debit total`).toBeGreaterThan(0);
      expect(shown.debit, `${value} debits equal credits`).toBe(shown.credit);
      await expect(page.locator("#trial-balance-status")).toHaveText("Debits equal credits.");
      const summed = await rowSums(page);
      // Each row is shown to the penny, so the rows add to the total within a penny a row.
      const rowCount = await page.locator("#trial-balance-table tbody tr").count();
      expect(Math.abs(summed.debit - shown.debit), `${value} account rows add to the debit total`).toBeLessThanOrEqual(
        rowCount * 0.005 + 0.001,
      );
      expect(Math.abs(summed.credit - shown.credit), `${value} account rows add to the credit total`).toBeLessThanOrEqual(
        rowCount * 0.005 + 0.001,
      );
    }
  });

  test("opens an account's lines on demand and they add up to its balance", async ({ page }) => {
    test.setTimeout(120_000);
    await openTrialBalance(page);
    await expect(page.locator("#trial-balance-lines")).toHaveCount(0);

    const row = page.locator('#trial-balance-table tbody tr:has([data-trial-balance-account="1300"])');
    await expect(row).toBeVisible();
    const balance = money(await row.locator("td").nth(1).innerText()) - money(await row.locator("td").nth(2).innerText());
    await row.locator("[data-trial-balance-account]").click();

    const panel = page.locator("#trial-balance-lines");
    await expect(panel).toBeVisible();
    const lines = await panel
      .locator("tbody tr")
      .evaluateAll((rows) => rows.map((r) => [r.children[3].textContent, r.children[4].textContent]));
    expect(lines.length).toBeGreaterThan(1);
    const net = lines.reduce((sum, [d, c]) => sum + Number(d.replace(/[£,\s]/g, "") || 0) - Number(c.replace(/[£,\s]/g, "") || 0), 0);
    expect(Math.round(net * 100)).toBe(Math.round(balance * 100));

    await panel.getByRole("button", { name: "Close" }).click();
    await expect(page.locator("#trial-balance-lines")).toHaveCount(0);
  });

  test("fits a phone screen with the totals in view", async ({ page }) => {
    test.setTimeout(120_000);
    await openTrialBalance(page, { width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator("#trial-balance-total-debit")).toBeAttached();
  });
});
