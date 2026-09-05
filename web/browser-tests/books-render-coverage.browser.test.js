// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd

// web/browser-tests/books-render-coverage.browser.test.js
//
// The render-equivalence sweep (assertion A5 in
// PLAN_DIYA_GL_BST_CLI_MCP_WEB.md): every cell/, section/ and check/ key
// report-serializer.js gives a scenario's R either carries a data-r-key
// somewhere on the books page, or is named with a reason in
// app/data/render-unrepresentable/bst.json. Neither side may run short --
// an undeclared absence fails, and so does a data-r-key the page invented.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const targetDir = path.join(process.cwd(), "target", "render-coverage");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".jsonl": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

let server;
let baseUrl;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const filePath = path.join(publicDir, requested);
    if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(fs.readFileSync(filePath));
  });
  await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolveClose) => server.close(resolveClose));
});

// The three examples the page's own buttons load, each paired with the
// report.js --data path that produces the same book's S2.
const BST_EXAMPLES = [
  { button: /bst-scenario-basic/, dataDir: "examples/precision-code-ltd/bst", outDir: "basic" },
  { button: /bst-brickwork-pro-nonvat/, dataDir: "examples/brickwork-pro/bst-nonvat", outDir: "brickwork" },
  { button: /bst-sp-sixty/, dataDir: "examples/sp-sixty-driving/bst", outDir: "sp-sixty" },
];

const SE_EXAMPLES = [
  { button: /se-scenario-advanced/, dataDir: "examples/precision-code-ltd/advanced", outDir: "se-advanced" },
  { button: /se-brickwork-pro-nonvat/, dataDir: "examples/brickwork-pro/se-nonvat", outDir: "se-brickwork-nonvat" },
  { button: /se-brickwork-pro-vat/, dataDir: "examples/brickwork-pro/se-vat", outDir: "se-brickwork-vat" },
];

const BST_DECLARED = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app/data/render-unrepresentable/bst.json"), "utf-8"));
const SE_DECLARED = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app/data/render-unrepresentable/se.json"), "utf-8"));

function s2KeysFor(outDir, dataDir, product = "bst") {
  const outputDir = path.join(targetDir, outDir);
  execFileSync(process.execPath, ["app/bin/report.js", "--package", product, "--data", dataDir, "--output-dir", outputDir], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const report = JSON.parse(fs.readFileSync(path.join(outputDir, "report.json"), "utf-8"));
  return new Set(report.values.map((v) => v.key));
}

const BST_VIEWS = ["year", "profit-loss", "stock", "debtors-creditors", "fixed-assets", "income-tax", "sa103s", "business-details", "admin"];
const SE_VIEWS = ["home", "year", "bank", "payroll", "profit-loss", "quarterly", "forecast", "stock", "ledgers", "fixed-assets", "income-tax", "sa103s", "sa103f", "vat", "business-details", "admin"];

// Every data-r-key on the page right now, across whichever views have been
// visited so far -- a single attribute may carry several keys (a figure
// that is both a cell and a printed section row), joined with " || ".
// Each element's own text (an <input>'s value, otherwise its textContent)
// must be non-empty: a key hooked onto nothing real would pass a naive
// "attribute exists" check and still tell a reader nothing.
async function collectRenderedKeys(page, runningKeys) {
  const found = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-r-key]")).map((el) => ({
      raw: el.getAttribute("data-r-key"),
      text: el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ? el.value : el.textContent,
    }));
  });
  for (const { raw, text } of found) {
    expect(text && text.trim().length > 0, `data-r-key="${raw}" carries no text`).toBe(true);
    for (const key of raw.split(" || ")) runningKeys.add(key);
  }
}

async function openEveryMonth(page, runningKeys) {
  const monthCount = await page.locator(".year-row").count();
  for (let i = 0; i < monthCount; i++) {
    await page.locator(".year-row").nth(i).click();
    const entriesToggle = page.locator("#entries-toggle");
    if (await entriesToggle.count()) {
      await entriesToggle.click();
    }
    await collectRenderedKeys(page, runningKeys);
  }
}

async function sweepPage(page, exampleButton, htmlFile, views) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/books/${htmlFile}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: exampleButton }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

  const runningKeys = new Set();
  for (const view of views) {
    await page.locator(`.tab-btn[data-view="${view}"]`).click();
    await collectRenderedKeys(page, runningKeys);
    if (view === "year") {
      await openEveryMonth(page, runningKeys);
    }
  }
  return runningKeys;
}

test.describe("DIYA-GL BST page — render-key coverage (A5)", () => {
  for (const example of BST_EXAMPLES) {
    test(`${example.outDir}: every S2 key is rendered or declared, nothing invented`, async ({ page }) => {
      const s2Keys = s2KeysFor(example.outDir, example.dataDir, "bst");
      const renderedKeys = await sweepPage(page, example.button, "bst.html", BST_VIEWS);

      const missing = [...s2Keys].filter((k) => !renderedKeys.has(k) && !(k in BST_DECLARED));
      // headline/* keys are the year-at-a-glance strip's own derived figures
      // (headlinesFromReport() over R, not a row R itself carries), so S2's
      // report.json never names them -- skipped by prefix rather than
      // widening what "invented" tolerates for cell/, section/ or check/.
      const invented = [...renderedKeys].filter((k) => !s2Keys.has(k) && !k.startsWith("headline/"));

      expect(missing, `S2 keys neither rendered nor declared:\n${missing.join("\n")}`).toEqual([]);
      expect(invented, `data-r-key values not in S2:\n${invented.join("\n")}`).toEqual([]);
    });
  }

  test("every declared key carries a reason, and the list is short next to S2's own size", async () => {
    const s2Keys = s2KeysFor("basic-declared-check", "examples/precision-code-ltd/bst", "bst");
    for (const [key, reason] of Object.entries(BST_DECLARED)) {
      expect(typeof reason === "string" && reason.trim().length > 0, `"${key}" carries no reason`).toBe(true);
    }
    expect(Object.keys(BST_DECLARED).length).toBeLessThan(s2Keys.size / 2);
  });
});

test.describe("DIYA-GL SE page — render-key coverage (A5)", () => {
  for (const example of SE_EXAMPLES) {
    test(`${example.outDir}: every S2 key is rendered or declared, nothing invented`, async ({ page }) => {
      const s2Keys = s2KeysFor(example.outDir, example.dataDir, "se");
      const renderedKeys = await sweepPage(page, example.button, "se.html", SE_VIEWS);

      const missing = [...s2Keys].filter((k) => !renderedKeys.has(k) && !(k in SE_DECLARED));
      const invented = [...renderedKeys].filter((k) => !s2Keys.has(k) && !k.startsWith("headline/"));

      expect(missing, `S2 keys neither rendered nor declared:\n${missing.join("\n")}`).toEqual([]);
      expect(invented, `data-r-key values not in S2:\n${invented.join("\n")}`).toEqual([]);
    });
  }

  test("every declared key carries a reason, and the list is short next to S2's own size", async () => {
    const s2Keys = s2KeysFor("se-advanced-declared-check", "examples/precision-code-ltd/advanced", "se");
    for (const [key, reason] of Object.entries(SE_DECLARED)) {
      expect(typeof reason === "string" && reason.trim().length > 0, `"${key}" carries no reason`).toBe(true);
    }
    expect(Object.keys(SE_DECLARED).length).toBeLessThan(s2Keys.size / 2);
  });
});
