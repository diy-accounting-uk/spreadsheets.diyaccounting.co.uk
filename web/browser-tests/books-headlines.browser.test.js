// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-headlines.browser.test.js
//
// The year-at-a-glance strip (books/headlines.js), mounted on its own
// probe page (books/headlines-probe.html) rather than through bst.html --
// the strip needs a snapshot and headlinesFromReport(), not a loaded
// workbook, so this spec never touches the engine bundle or the schema
// validators bst.html's own specs exercise. It serves the public
// directory over plain HTTP with no security headers (headlines.js has no
// eval-dependent code path to prove clean against the CSP the other books
// specs check; serve.js is for that proof and stays untouched here).
//
// The Node side of the equivalence: app/bin/report.js builds R the same
// way the reconciliation pipeline does, from the precision-code-ltd/bst
// fixture, and app/lib/bst-headlines.js's own headlinesFromReport() turns
// that R into the expected tiles and pies directly in Node. The browser
// side goes the long way round -- a synthetic books-page snapshot, built
// from the same R's cell values, through headlines.js's own R adapter,
// through the same headlinesFromReport() (esbuilt into a browser global,
// never a copy under public/) -- so the two paths meeting on the same
// numbers proves the adapter round-trips.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import * as esbuild from "esbuild";
import { headlinesFromReport } from "../../app/lib/bst-headlines.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "target");
fs.mkdirSync(screenshotsDir, { recursive: true });

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

// A plain static server, no security headers -- headlines.js has no
// eval-dependent path, so there is nothing here for a strict CSP to prove.
// The two named options for a books spec under the CSP-carrying serve.js
// are a snapshot-fed probe page (this spec's approach) or a copy of
// serve.js's server pattern with the header stripped; this is the second,
// written inline so the spec owns its own server rather than adding a
// shared file.
function startPlainServer(rootDir) {
  const server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const filePath = path.join(rootDir, requested);
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(fs.readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve({ baseUrl, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

function valueOf(report, key) {
  const entry = report.values.find((v) => v.key === key);
  if (!entry) throw new Error("report carries no value for " + key);
  return Number(entry.value);
}

// The BST tax year: April through the following March.
function buildMonths() {
  const labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  return labels.map((label, i) => {
    const monthNumber = ((i + 3) % 12) + 1;
    const year = monthNumber >= 4 ? 2025 : 2026;
    return { key: year + "-" + String(monthNumber).padStart(2, "0"), label };
  });
}

// A books-page snapshot shaped exactly as bst-data.js's assembleSnapshot()
// returns it, but built from R's own cell values rather than a loaded
// book, so headlines.js's reportFromSnapshot() reconstructs the same R the
// fixture actually carries. The debtors monthly breakdown collapses to one
// opening figure equal to the true total -- debtorsTotal() only needs the
// sum, and this spec asserts the adapter's cell values, not the ledger's
// month-by-month shape.
function snapshotFromReport(report) {
  const pl = (ref) => valueOf(report, "cell/Profit & Loss Acc!" + ref);
  const months = buildMonths();
  const monthlySales = pl("C4") / 12;
  const monthlyCosts = (pl("C6") + pl("C7") + pl("C22")) / 12;
  const monthly = {};
  months.forEach((m, i) => {
    const wobble = 1 + ((i % 4) - 1.5) * 0.08;
    monthly[m.key] = {
      sales: monthlySales * wobble,
      costOfSales: (pl("C6") / 12) * wobble,
      directCosts: (pl("C7") / 12) * wobble,
      totalExpenses: (pl("C22") / 12) * wobble,
      netProfit: monthlySales * wobble - monthlyCosts * wobble,
    };
  });
  return {
    annual: {
      sales: pl("C4"),
      costOfSales: pl("C6"),
      directCosts: pl("C7"),
      employeeCosts: pl("C11"),
      premisesCosts: pl("C12"),
      repairs: pl("C13"),
      generalAdmin: pl("C14"),
      motorExpenses: pl("C15"),
      travel: pl("C16"),
      advertising: pl("C17"),
      legalProfessional: pl("C18"),
      badDebts: pl("C19"),
      interestFinance: pl("C20"),
      otherExpenses: pl("C21"),
      totalExpenses: pl("C22"),
    },
    fixedAssets: { writtenDownValue: valueOf(report, "cell/Fixed Assets!M1") },
    stock: { closing: valueOf(report, "cell/PurchasesStock!D30") },
    debtors: { opening: valueOf(report, "cell/Debtors & Creditors!C29"), monthly: [] },
    incomeTax: { totalTaxAndNi: valueOf(report, "cell/Income Tax!E18") },
    months,
    monthly,
  };
}

// A hand-built snapshot for the loss branch: turnover cut below outgoings,
// nothing derived from a fixture.
function lossSnapshot() {
  const months = buildMonths();
  const monthly = {};
  months.forEach((m) => {
    monthly[m.key] = { sales: 1000, costOfSales: 400, directCosts: 100, totalExpenses: 900, netProfit: -400 };
  });
  return {
    annual: {
      sales: 12000,
      costOfSales: 4800,
      directCosts: 1200,
      employeeCosts: 3000,
      premisesCosts: 2000,
      repairs: 500,
      generalAdmin: 400,
      motorExpenses: 600,
      travel: 300,
      advertising: 200,
      legalProfessional: 300,
      badDebts: 100,
      interestFinance: 100,
      otherExpenses: 300,
      totalExpenses: 10800,
    },
    fixedAssets: { writtenDownValue: 0 },
    stock: { closing: 0 },
    debtors: { opening: 0, monthly: [] },
    incomeTax: { totalTaxAndNi: 0 },
    months,
    monthly,
  };
}

function parseMoney(text) {
  return parseFloat(text.replace(/[^0-9.-]/g, ""));
}

const VIEWPORTS = {
  "desktop-landscape": { width: 1440, height: 900 },
  "desktop-portrait": { width: 1024, height: 1366 },
  "mobile-landscape": { width: 844, height: 390 },
  "mobile-portrait": { width: 390, height: 844 },
};

let closeServer;
let baseUrl;
let engineBundlePath;
let realReport;
let expectedHeadlines;
let axeAvailable = false;
let AxeBuilder = null;

test.beforeAll(async () => {
  const server = await startPlainServer(publicDir);
  baseUrl = server.baseUrl;
  closeServer = server.close;

  // The R the Node reconciliation pipeline itself builds for this fixture,
  // via the same report.js CLI the reconciliation waves use.
  const outputDir = path.join(process.cwd(), "target", "r-basic");
  execFileSync(
    process.execPath,
    [
      path.join(process.cwd(), "app/bin/report.js"),
      "--package",
      "bst",
      "--data",
      path.join(process.cwd(), "examples/precision-code-ltd/bst"),
      "--output-dir",
      outputDir,
    ],
    { stdio: "pipe" },
  );
  realReport = JSON.parse(fs.readFileSync(path.join(outputDir, "report.json"), "utf8"));
  expectedHeadlines = headlinesFromReport(realReport);

  // bst-headlines.js is ESM; the page loads classic scripts only, so it is
  // esbuilt into a browser global for the probe page's own use -- built
  // into target/, never copied under public/.
  engineBundlePath = path.join(process.cwd(), "target", "bst-headlines.browser.js");
  await esbuild.build({
    entryPoints: [path.join(process.cwd(), "app/lib/bst-headlines.js")],
    bundle: true,
    format: "iife",
    globalName: "DiyaGlHeadlinesEngine",
    outfile: engineBundlePath,
  });

  try {
    ({ default: AxeBuilder } = await import("@axe-core/playwright"));
    axeAvailable = true;
  } catch (e) {
    axeAvailable = false;
  }
});

test.afterAll(async () => {
  await closeServer();
});

async function mountStrip(page, snapshotJson) {
  await page.goto(`${baseUrl}/books/headlines-probe.html`);
  await page.addScriptTag({ path: engineBundlePath });
  await page.evaluate((snapshot) => {
    var fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
    window.__headlinesMount = window.DiyaGlHeadlines.mountHeadlines(document.getElementById("root"), {
      snapshot: snapshot,
      headlinesFromReport: window.DiyaGlHeadlinesEngine.headlinesFromReport,
      formatMoney: function (n) {
        return fmt.format(n);
      },
    });
  }, snapshotJson);
}

test.describe("DIYA-GL headlines strip — tiles equal bst-headlines.js's own figures", () => {
  test("the four tile values equal headlinesFromReport(report.json) computed in Node", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));

    const turnover = parseMoney(await page.locator('[data-r-key="headline/turnover"]').textContent());
    const outgoings = parseMoney(await page.locator('[data-r-key="headline/outgoings"]').textContent());
    const assets = parseMoney(await page.locator('[data-r-key="headline/assets"]').textContent());
    const tax = parseMoney(await page.locator('[data-r-key="headline/tax"]').textContent());

    expect(turnover).toBeCloseTo(expectedHeadlines.tiles.turnover.value, 2);
    expect(outgoings).toBeCloseTo(expectedHeadlines.tiles.outgoings.total.value, 2);
    expect(assets).toBeCloseTo(expectedHeadlines.tiles.assets.total.value, 2);
    expect(tax).toBeCloseTo(expectedHeadlines.tiles.tax.value, 2);
  });

  test("the outgoings tile's sub-line names cost of sales and running costs", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));
    const sub = await page.locator(".headline-tile-sub").first().textContent();
    expect(sub).toContain("cost of sales");
    expect(sub).toContain("running costs");
  });

  test("the assets tile totals what the business holds and reports what it is owed beside it", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));
    const subs = await page.locator(".headline-tile-sub").allTextContents();
    const assetsSub = subs.find((s) => s.includes("written-down"));
    expect(assetsSub).toBeDefined();
    expect(assetsSub).toContain("stock");
    expect(assetsSub).toContain("owed to you");
    expect(assetsSub).toContain("counted separately");

    // The tile's figure is the written-down value plus stock, and nothing
    // else: what customers owe is beside it, not inside it.
    const total = parseMoney(await page.locator('[data-r-key="headline/assets"]').textContent());
    const owed = expectedHeadlines.tiles.assets.debtors.value;
    expect(total).toBeCloseTo(expectedHeadlines.tiles.assets.writtenDown.value + expectedHeadlines.tiles.assets.stock.value, 2);
    expect(owed).toBeGreaterThan(total);
  });

  test("the tax tile states what it includes", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));
    const subs = await page.locator(".headline-tile-sub").allTextContents();
    expect(subs.some((s) => s.includes("income tax and Class 4 NI, less CIS"))).toBe(true);
  });
});

test.describe("DIYA-GL headlines strip — the pies sum to the tiles and prove out via the table", () => {
  test("the turnover pie's slices sum to the turnover tile", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));
    const amounts = await page.locator('[data-pie-table="turnover"] tbody tr td:nth-of-type(1)').allTextContents();
    const sum = amounts.reduce((s, a) => s + parseMoney(a), 0);
    expect(sum).toBeCloseTo(expectedHeadlines.tiles.turnover.value, 2);
  });

  test("the outgoings pie's slices sum to the outgoings tile", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));
    const amounts = await page.locator('[data-pie-table="outgoings"] tbody tr td:nth-of-type(1)').allTextContents();
    const sum = amounts.reduce((s, a) => s + parseMoney(a), 0);
    expect(sum).toBeCloseTo(expectedHeadlines.tiles.outgoings.total.value, 2);
  });

  test("the outgoings pie never shows more than the five-step palette can colour", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));
    const rows = await page.locator('[data-pie-table="outgoings"] tbody tr').count();
    expect(rows).toBeLessThanOrEqual(5);
    const swatches = await page.locator('[data-pie-legend="outgoings"] .headline-legend-swatch').count();
    expect(swatches).toBeLessThanOrEqual(5);
  });

  test("the table alternative is always in the DOM, visually hidden until toggled", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));
    const table = page.locator('[data-pie-table="turnover"]');
    await expect(table).toHaveClass(/visually-hidden/);
    await expect(table).toBeAttached();
    const rows = await table.locator("tbody tr").count();
    expect(rows).toBe(4);

    await page.locator('[data-pie-table-toggle="turnover"]').click();
    await expect(table).not.toHaveClass(/visually-hidden/);
    await expect(page.locator('[data-pie-table-toggle="turnover"]')).toHaveAttribute("aria-expanded", "true");
  });

  test("a direct slice label is drawn whole or not at all, and the legend sits beside the chart", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));

    const labels = await page.locator('[data-pie-block="outgoings"] .headline-pie-direct-label').allTextContents();
    for (const label of labels) {
      expect(label, "a direct label is never cut short with an ellipsis").not.toContain("…");
    }

    const svgRight = await page
      .locator('[data-pie-block="outgoings"] .headline-pie-svg')
      .evaluate((el) => el.getBoundingClientRect().right);
    const legendLeft = await page.locator('[data-pie-legend="outgoings"]').evaluate((el) => el.getBoundingClientRect().left);
    expect(legendLeft, "the legend sits beside the pie, not under it").toBeGreaterThanOrEqual(svgRight - 1);
  });

  test("the through-the-year charts start collapsed", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));
    const details = page.locator(".headline-through-year");
    await expect(details).not.toHaveAttribute("open", "");
    await expect(page.locator(".headline-through-year-body")).toBeHidden();

    await page.locator(".headline-through-year summary").click();
    await expect(page.locator(".headline-through-year-body")).toBeVisible();
  });

  test("the turnover pie renders as a pie for this profitable fixture", async ({ page }) => {
    await mountStrip(page, snapshotFromReport(realReport));
    await expect(page.locator('[data-pie-block="turnover"] .headline-pie-svg')).toBeVisible();
    await expect(page.locator('[data-pie-block="turnover"] .headline-bar-svg')).toHaveCount(0);
  });
});

test.describe("DIYA-GL headlines strip — the loss branch draws a bar, not a pie", () => {
  test("a net loss puts the turnover chart in bar mode with the module's own reason", async ({ page }) => {
    await mountStrip(page, lossSnapshot());
    await expect(page.locator('[data-pie-block="turnover"] .headline-bar-svg')).toBeVisible();
    await expect(page.locator('[data-pie-block="turnover"] .headline-pie-svg')).toHaveCount(0);
    const reason = await page.locator('[data-pie-block="turnover"] .headline-pie-reason').textContent();
    expect(reason).toMatch(/loss/);

    const turnoverTile = parseMoney(await page.locator('[data-r-key="headline/turnover"]').textContent());
    expect(turnoverTile).toBeCloseTo(12000, 2);
  });
});

test.describe("DIYA-GL headlines strip — accessibility", () => {
  test("axe reports zero serious or critical violations on the loaded strip", async ({ page }) => {
    test.skip(!axeAvailable, "@axe-core/playwright is not present under node_modules; not installing it for this check.");
    await mountStrip(page, snapshotFromReport(realReport));
    const results = await new AxeBuilder({ page }).include(".headlines-strip").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 2)).toHaveLength(0);
  });
});

test.describe("DIYA-GL headlines strip — four layouts", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`renders at ${name} (${viewport.width}x${viewport.height})`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await mountStrip(page, snapshotFromReport(realReport));
      await expect(page.locator(".headlines-strip")).toBeVisible();

      const filePath = path.join(screenshotsDir, `headlines-${name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      await testInfo.attach(`headlines-${name}`, { path: filePath, contentType: "image/png" });
    });
  }
});
