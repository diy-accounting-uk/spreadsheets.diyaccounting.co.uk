// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-ltd-render-coverage.browser.test.js
//
// The render-equivalence sweep for Ltd (assertion T9 in
// PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md): every cell/, section/ and check/ key
// report-serializer.js gives a Company book's R either carries a data-r-key
// somewhere on the books page, or is named with a reason in
// app/data/render-unrepresentable/ltd.json. Neither side may run short --
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

// The three Ltd examples the page's own buttons load, each paired with the
// report.js --data path that produces the same book's S2.
const LTD_EXAMPLES = [
  { button: /ltd-scenario-full/, dataDir: "examples/precision-code-ltd/full", outDir: "ltd-full" },
  { button: /ltd-brickwork-pro-vat/, dataDir: "examples/brickwork-pro/ltd-vat", outDir: "ltd-brickwork-vat" },
  { button: /ltd-brickwork-pro-nonvat/, dataDir: "examples/brickwork-pro/ltd-nonvat", outDir: "ltd-brickwork-nonvat" },
];

const LTD_DECLARED = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app/data/render-unrepresentable/ltd.json"), "utf-8"));

function s2KeysFor(outDir, dataDir, product = "ltd") {
  const outputDir = path.join(targetDir, outDir);
  const args = ["app/bin/report.js", "--package", product, "--data", dataDir, "--output-dir", outputDir];
  execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const report = JSON.parse(fs.readFileSync(path.join(outputDir, "report.json"), "utf-8"));
  return new Set(report.values.map((v) => v.key));
}

const LTD_VIEWS = [
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
];

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
  const empty = [];
  for (const { raw, text } of found) {
    if (!text || text.trim().length === 0) empty.push(raw);
    for (const key of raw.split(" || ")) runningKeys.add(key);
  }
  expect(empty, `data-r-key values carrying no text:\n${empty.join("\n")}`).toEqual([]);
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

// The Profit & Loss statement's month columns sit behind #pl-months-toggle,
// collapsed by default, so the sweep opens it before collecting that view's keys.
async function openMonthsToggleIfPresent(page) {
  const toggle = page.locator("#pl-months-toggle");
  if (await toggle.count()) {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      await toggle.click();
    }
  }
}

// The bank book shows one account at a time behind its own switch, so the
// sweep picks each account in turn.
async function openEveryAccount(page, runningKeys) {
  const accountCount = await page.locator(".account-switch-btn").count();
  for (let i = 0; i < accountCount; i++) {
    await page.locator(".account-switch-btn").nth(i).click();
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
    await openMonthsToggleIfPresent(page);
    await collectRenderedKeys(page, runningKeys);
    if (view === "year") {
      await openEveryMonth(page, runningKeys);
    }
    if (view === "bank") {
      await openEveryAccount(page, runningKeys);
    }
  }
  return runningKeys;
}

test.describe("DIYA-GL Ltd page — render-key coverage (T9)", () => {
  for (const example of LTD_EXAMPLES) {
    test(`${example.outDir}: every S2 key is rendered or declared, nothing invented`, async ({ page }) => {
      test.setTimeout(240_000);
      const s2Keys = s2KeysFor(example.outDir, example.dataDir, "ltd");
      const renderedKeys = await sweepPage(page, example.button, "ltd.html", LTD_VIEWS);

      const missing = [...s2Keys].filter((k) => !renderedKeys.has(k) && !(k in LTD_DECLARED));
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
    const s2Keys = s2KeysFor("ltd-full-declared-check", "examples/precision-code-ltd/full", "ltd");
    for (const [key, reason] of Object.entries(LTD_DECLARED)) {
      expect(typeof reason === "string" && reason.trim().length > 0, `"${key}" carries no reason`).toBe(true);
    }
    expect(Object.keys(LTD_DECLARED).length).toBeLessThan(s2Keys.size / 3);
  });
});
