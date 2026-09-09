// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/books-ltd-page.browser.test.js
//
// LT-T7's own proof: the Ltd page (books/ltd.html) boots on a real,
// thirteen-workbook Limited Company package, every VIEWS id renders with no
// console error, the Year view's Sales column agrees with the fixture the
// package was generated from, and every data-r-key the page renders is a
// key report.js --source-dir also carries for the same package. No example
// is registered for Ltd yet (LT-T10), so the package reaches the page the
// way the Self Employed nine-file proof does: zipped and dropped, the same
// door the page's own diya-gl upload uses.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { startStaticServer } from "./serve.js";
import { taxYearFileName } from "../../app/lib/product-workbook.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const PACKAGE_DIR = path.join(ROOT, "examples/ltd-latest");
const TARGET_DIR = path.join(ROOT, "target", "books-ltd-page");

fs.mkdirSync(TARGET_DIR, { recursive: true });

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

function ltdUrl(search) {
  return `${baseUrl}/books/ltd.html${search || ""}`;
}

// Every uncaught error and every console error the page raises while a test
// drives it, so a view that throws is a failure rather than a blank panel.
function watchForErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

function packageWorkbookNames() {
  return fs.readdirSync(PACKAGE_DIR).filter((file) => file.endsWith(".xlsx"));
}

async function ltdLatestZipBytes() {
  const zip = new JSZip();
  for (const name of packageWorkbookNames()) {
    zip.file(name, fs.readFileSync(path.join(PACKAGE_DIR, name)));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

// The same synthetic-drop upload the SE nine-file proof uses
// (books-se-equivalence.browser.test.js): a File built from the zip bytes,
// dropped on the empty state, which is the same door the page's own
// diya-gl upload goes through.
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

async function waitForLoaded(page) {
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function openPackage(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ltdUrl(), { waitUntil: "domcontentloaded" });
  await dropFile(page, await ltdLatestZipBytes(), "ltd-latest.zip");
  await waitForLoaded(page);
}

function money(text) {
  return Number(String(text).replace(/[£,\s]/g, ""));
}

// Visits every VIEWS id in order, returning the set of every data-r-key
// half rendered anywhere on the page (a joined "cell/... || section/..."
// attribute counts as two).
async function sweepEveryView(page) {
  const viewIds = await page.evaluate(() => window.DiyaGlBooksPage.manifest.views.map((view) => view.id));
  const rKeys = new Set();
  const rootHtmlByView = {};

  for (const viewId of viewIds) {
    await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
    await expect(page.locator(`.tab-btn[data-view="${viewId}"]`)).toHaveAttribute("aria-selected", "true");
    const root = page.locator("#view-root");
    await expect(root).toBeVisible();
    rootHtmlByView[viewId] = (await root.innerHTML()).trim();

    if (viewId === "year") {
      // The month rows drill into the entries grid, which is where the
      // journal switch and the posted-line figures render.
      const monthCount = await page.locator(".year-row").count();
      if (monthCount > 0) await page.locator(".year-row").first().click();
    }

    const found = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-r-key]")).map((el) => el.getAttribute("data-r-key")),
    );
    for (const raw of found) {
      for (const key of raw.split(" || ")) rKeys.add(key);
    }
  }

  return { viewIds, rKeys, rootHtmlByView };
}

test.describe("DIYA-GL books page — Ltd page boots on a real package (LT-T7)", () => {
  test("every VIEWS id renders with no console error and a non-empty view root", async ({ page }) => {
    const errors = watchForErrors(page);
    await openPackage(page);

    const { viewIds, rootHtmlByView } = await sweepEveryView(page);

    expect(viewIds).toEqual([
      "home",
      "year",
      "bank",
      "ledgers",
      "profit-loss",
      "stock",
      "fixed-assets",
      "business-details",
      "admin",
      "accounts",
      "corporation-tax",
      "ct600",
      "vat-returns",
      "payroll",
      "company",
    ]);
    for (const viewId of viewIds) {
      expect(rootHtmlByView[viewId].length, `${viewId} view root is non-empty`).toBeGreaterThan(0);
    }
    expect(errors, "the page raised no console error across every view").toEqual([]);
  });

  test("the Year view's Sales column totals 341,283 for the full scenario", async ({ page }) => {
    await openPackage(page);
    await page.locator('.tab-btn[data-view="year"]').click();

    const salesCell = page.locator('.year-totals [data-r-key*="MnthP&L!B9"]').first();
    await expect(salesCell).toBeVisible();
    expect(money(await salesCell.textContent())).toBeCloseTo(341283.33, 1);
  });

  // report.js --data needs a diya-gl book.toml + lines.jsonl, and
  // examples/ltd-latest is an xlsx-only fixture, so this exports one from
  // the very same package the page uploads (app/bin/export.js's
  // --source-dir mode: the same extractLines/extractBook the browser's
  // upload path runs), then computes R from that export the way --data
  // does. "The same package" this way rather than --source-dir's own
  // "saved" mode, which never carries a check/ key -- the inspector's own
  // panel renders those, and the page renders it on every view.
  function reportKeysForLtdLatest() {
    const exportDir = path.join(TARGET_DIR, "export");
    execFileSync(
      process.execPath,
      ["app/bin/export.js", "--package", "ltd", "--source-dir", "examples/ltd-latest", "--output-dir", exportDir],
      { cwd: ROOT, stdio: "pipe" },
    );
    const book = parseTOML(fs.readFileSync(path.join(exportDir, "book.toml"), "utf-8"));
    const yearEnd = new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);

    const reportDir = path.join(TARGET_DIR, "report");
    execFileSync(
      process.execPath,
      [
        "app/bin/report.js",
        "--package",
        "ltd",
        "--data",
        exportDir,
        "--years",
        taxYearFileName(new Date(yearEnd), "ltd"),
        "--year-end",
        yearEnd,
        "--output-dir",
        reportDir,
      ],
      { cwd: ROOT, stdio: "pipe" },
    );
    const report = JSON.parse(fs.readFileSync(path.join(reportDir, "report.json"), "utf-8"));
    return new Set(report.values.map((entry) => entry.key));
  }

  test("every data-r-key the page renders exists in report.js --data output for the same package", async ({ page }) => {
    const reportKeys = reportKeysForLtdLatest();

    await openPackage(page);
    const { rKeys } = await sweepEveryView(page);
    expect(rKeys.size, "the page rendered at least one data-r-key").toBeGreaterThan(0);
    // headline/* keys are the year-at-a-glance strip's own derived figures
    // (headlines.js), not a CELL_MAP cell or section of their own -- the
    // shared render-coverage sweep (books-render-coverage.browser.test.js)
    // excludes them the same way.
    const missing = Array.from(rKeys).filter((key) => !reportKeys.has(key) && !key.startsWith("headline/"));
    expect(missing, missing.join("\n")).toEqual([]);
  });

  test("the payroll journal carries a real chart of accounts, not an empty one", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(ltdUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /ltd-scenario-full/ }).click();
    await waitForLoaded(page);

    // April is the first month and entries start open (shell.js's
    // yearState() defaults entriesOpen to true), so the journal switch is
    // already on the page with no row or toggle click needed.
    await page.locator('.journal-switch-btn[data-journal-switch="payroll"]').click();

    const payrollTable = page.locator('table.entries-table[data-journal="payroll"]');
    await expect(payrollTable).toBeVisible();
    await expect(payrollTable.locator("tr.entry-row")).toHaveCount(3);
    const payrollNames = await payrollTable.locator("tr.entry-row .entry-account-name").allTextContents();
    expect(payrollNames.sort()).toEqual(["Directors wages (non-PAYE)", "Employee wages (non-PAYE)", "Employee wages (non-PAYE)"]);
    await expect(payrollTable.locator(".entry-add-account option")).toHaveCount(2);
  });
});
