// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-deep-links.browser.test.js
//
// The books page's ?example=/&view=/&month= deep links (PLAN_DIYA_GL_BST_CLI_MCP_WEB.md,
// T16): a link loads one of the three example books on arrival, lands on a
// view or an open month, and keeps the URL current as the reader moves
// around -- without ever touching the IndexedDB autosave record.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import JSZip from "jszip";
import path from "node:path";
import { startStaticServer } from "./serve.js";
import { encodeBookFragment } from "../../app/lib/diya-gl-link.js";

const publicDir = path.join(process.cwd(), "web/diya-gl.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "reports/screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });

const VIEWPORTS = {
  "desktop-landscape": { width: 1440, height: 900 },
};

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

function bstUrl(search) {
  return `${baseUrl}/bst.html${search || ""}`;
}

function seUrl(search) {
  return `${baseUrl}/se.html${search || ""}`;
}

const EXAMPLES = [
  { key: "bst-scenario-basic", name: "Precision Code Trading" },
  { key: "bst-brickwork-pro-nonvat", name: "BrickWork Pro Trading" },
  { key: "bst-sp-sixty", name: "SP Sixty Driving" },
];

const SE_EXAMPLE_KEYS = ["se-scenario-advanced", "se-brickwork-pro-nonvat", "se-brickwork-pro-vat"];

function encodedExample(dir) {
  return encodeBookFragment({
    toml: fs.readFileSync(path.join(process.cwd(), "examples", dir, "book.toml"), "utf8"),
    lines: fs.readFileSync(path.join(process.cwd(), "examples", dir, "lines.jsonl"), "utf8"),
  }).fragment;
}

test.describe("DIYA-GL page — #book= opens a whole book from the link", () => {
  test("#book=<data> loads the book, then leaves the address bar without the fragment", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(`?view=profit-loss#book=${encodedExample("precision-code-ltd/bst")}`), { waitUntil: "domcontentloaded" });

    await expect(page.locator("#app-title")).toContainText("Precision Code Trading", { timeout: 30_000 });
    await expect(page.locator(".empty-state")).toHaveCount(0);
    await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => page.url()).not.toContain("#book=");
    expect(new URL(page.url()).search).toBe("?view=profit-loss");
    await page.screenshot({ path: path.join(screenshotsDir, "diya-gl-book-link-loaded.png") });
  });

  test("a link book shows no continue offer and leaves a saved book alone", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-sp-sixty/ }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    await page.goto(bstUrl(`#book=${encodedExample("precision-code-ltd/bst")}`), { waitUntil: "domcontentloaded" });
    await expect(page.locator("#app-title")).toContainText("Precision Code Trading", { timeout: 30_000 });
    await expect(page.locator(".continue-offer")).toHaveCount(0);

    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".continue-offer")).toContainText(/sp-sixty/, { timeout: 10_000 });
  });

  test("a damaged #book= shows the empty state naming the problem", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("#book=AAAA"), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state")).toBeVisible();
    await expect(page.locator("#empty-state-message")).toContainText("The book link is damaged", { timeout: 30_000 });
  });
});

test.describe("DIYA-GL page — deep links load an example on arrival", () => {
  for (const example of EXAMPLES) {
    test(`?example=${example.key} loads ${example.name} straight away`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
      await page.goto(bstUrl(`?example=${example.key}`), { waitUntil: "domcontentloaded" });

      await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
      await expect(page.locator("#app-title")).toContainText(example.name);
      // A link never shows the file picker's own empty-state card.
      await expect(page.locator(".empty-state")).toHaveCount(0);
    });
  }

  test("&view=income-tax lands on the Income Tax view once the book has loaded", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?example=bst-scenario-basic&view=income-tax"), { waitUntil: "domcontentloaded" });

    await expect(page.locator('.tab-btn[data-view="income-tax"]')).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await expect(page.locator(".form-render .form-name")).toHaveText(/Income Tax/);
  });

  test("&month=2025-06 opens June, with its entries, in the year view", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?example=bst-scenario-basic&month=2025-06"), { waitUntil: "domcontentloaded" });

    const juneRow = page.locator('.year-row[data-month="2025-06"]');
    await expect(juneRow).toHaveAttribute("aria-expanded", "true", { timeout: 30_000 });
    await expect(page.locator(".month-detail-row")).toHaveCount(1);
    // The month opens with its entries already showing, not collapsed.
    await expect(page.locator("#entries-toggle")).toContainText("Hide entries");
    await expect(page.locator("table.entries-table").first()).toBeVisible();
  });

  test("an unknown example id shows the empty state and names the three known ones", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?example=nope"), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state")).toBeVisible();
    const message = page.locator("#empty-state-message");
    await expect(message).toContainText("bst-scenario-basic");
    await expect(message).toContainText("bst-brickwork-pro-nonvat");
    await expect(message).toContainText("bst-sp-sixty");
  });

  test("?view=stock alone, with no example, leaves the empty state untouched", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?view=stock"), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state")).toBeVisible();
    await expect(page.locator(".year-table-scroll, .month-cards")).toHaveCount(0);
    await expect(page.locator("#empty-state-message")).toHaveText("");
  });

  test("clicking the P&L tab after a link load updates the URL to match", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl("?example=bst-scenario-basic"), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => new URL(page.url()).search).toContain("view=profit-loss");
    await expect.poll(() => new URL(page.url()).search).toContain("example=bst-scenario-basic");
  });

  test("an uploaded or new book never gets an example id written into the URL", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Start a new book" }).click();
    await page.locator("#new-book-name").fill("Acorn Trading");
    await page.locator("#new-book-year-end").fill("2026-03-31");
    await page.getByRole("button", { name: "Create book" }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    await page.locator('.tab-btn[data-view="profit-loss"]').click();
    await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).search).toBe("");
  });
});

test.describe("DIYA-GL page — a deep link never touches the autosave record", () => {
  test("a link arrival shows no continue offer and leaves a saved book alone", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);

    // Seed an autosave record the ordinary way: load an example through its
    // own button, exactly as diya-gl-empty-state.browser.test.js does.
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-sp-sixty/ }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    // A link arrival for a different example: no continue offer appears,
    // and it loads its own book rather than the saved one.
    await page.goto(bstUrl("?example=bst-scenario-basic"), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    await expect(page.locator(".continue-offer")).toHaveCount(0);
    await expect(page.locator("#app-title")).toContainText("Precision Code Trading");

    // A later plain arrival still offers the original saved book -- the
    // link never overwrote it.
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    const offer = page.locator(".continue-offer");
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await expect(offer).toContainText(/sp-sixty/);
  });
});

test.describe("DIYA-GL page — SE deep links", () => {
  test("?example=se-brickwork-pro-nonvat&view=bank lands on the bank view", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(seUrl("?example=se-brickwork-pro-nonvat&view=bank"), { waitUntil: "domcontentloaded" });

    await expect(page.locator('.tab-btn[data-view="bank"]')).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await expect(page.locator("h2")).toContainText("Bank book");
  });

  test("an unknown example id shows the empty state and names the three known SE ids", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(seUrl("?example=nope"), { waitUntil: "domcontentloaded" });

    await expect(page.locator(".empty-state")).toBeVisible();
    const message = page.locator("#empty-state-message");
    const buttonKeys = await page.locator("[data-example]").evaluateAll((buttons) => buttons.map((b) => b.getAttribute("data-example")));
    expect(buttonKeys).toEqual(SE_EXAMPLE_KEYS);
    for (const key of SE_EXAMPLE_KEYS) await expect(message).toContainText(key);
  });
});

test.describe("DIYA-GL page — ?book=<url> opens a book from an allowed host", () => {
  let bookServer;
  let pageServer;
  let bookOrigin;
  let headersDir;
  const bookToml = fs.readFileSync(path.join(process.cwd(), "examples", "precision-code-ltd/bst", "book.toml"), "utf8");
  const bookLines = fs.readFileSync(path.join(process.cwd(), "examples", "precision-code-ltd/bst", "lines.jsonl"), "utf8");

  test.beforeAll(async () => {
    const zip = new JSZip();
    zip.file("book.toml", bookToml);
    zip.file("lines.jsonl", bookLines);
    const zipBytes = await zip.generateAsync({ type: "nodebuffer" });
    const jsonBytes = Buffer.from(JSON.stringify({ toml: bookToml, lines: bookLines }));

    bookServer = http.createServer((req, res) => {
      res.setHeader("access-control-allow-origin", "*");
      if (req.url.startsWith("/book.zip")) res.writeHead(200, { "content-type": "application/zip" }).end(zipBytes);
      else if (req.url.startsWith("/book.json")) res.writeHead(200, { "content-type": "application/json" }).end(jsonBytes);
      else res.writeHead(403, { "content-type": "application/xml" }).end("<Error><Code>AccessDenied</Code></Error>");
    });
    await new Promise((resolve) => bookServer.listen(0, "127.0.0.1", resolve));
    bookOrigin = `http://127.0.0.1:${bookServer.address().port}`;

    // The page's policy names only the production hosts, so the page server
    // gets the same policy with the in-test book server added to connect-src.
    const headers = JSON.parse(fs.readFileSync(path.join(process.cwd(), "infra/main/resources/diya-gl-security-headers.json"), "utf8"));
    headers.contentSecurityPolicy = headers.contentSecurityPolicy.replace("connect-src 'self' ", `connect-src 'self' ${bookOrigin} `);
    headersDir = fs.mkdtempSync(path.join(os.tmpdir(), "diya-gl-headers-"));
    const headersPath = path.join(headersDir, "headers.json");
    fs.writeFileSync(headersPath, JSON.stringify(headers));
    pageServer = await startStaticServer(publicDir, headersPath);
  });

  test.afterAll(async () => {
    await pageServer.close();
    await new Promise((resolve) => bookServer.close(resolve));
    fs.rmSync(headersDir, { recursive: true, force: true });
  });

  for (const [file, label] of [
    ["book.zip", "a diya-gl zip"],
    ["book.json", "{ toml, lines } JSON"],
  ]) {
    test(`?book=<url of ${label}> loads the book and leaves the query string without book`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
      await page.goto(`${pageServer.baseUrl}/bst.html?view=profit-loss&book=${encodeURIComponent(`${bookOrigin}/${file}`)}`, {
        waitUntil: "domcontentloaded",
      });

      await expect(page.locator("#app-title")).toContainText("Precision Code Trading", { timeout: 30_000 });
      await expect(page.locator(".empty-state")).toHaveCount(0);
      await expect(page.locator('.tab-btn[data-view="profit-loss"]')).toHaveAttribute("aria-selected", "true");
      await expect.poll(() => new URL(page.url()).searchParams.has("book")).toBe(false);
      expect(new URL(page.url()).search).toBe("?view=profit-loss");
      if (file === "book.zip") await page.screenshot({ path: path.join(screenshotsDir, "diya-gl-book-url-loaded.png") });
    });
  }

  test("a host off the allow-list is refused with the places books open from", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(`${pageServer.baseUrl}/bst.html?book=${encodeURIComponent("https://example.com/x.zip")}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator(".empty-state")).toBeVisible();
    await expect(page.locator("#empty-state-message")).toContainText("This page opens books only from", { timeout: 30_000 });
    await expect(page.locator("#empty-state-message")).toContainText("d2hg4qibpn6ch3.cloudfront.net");
  });

  test("a 403 from the book host says the link may have expired, naming the status", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS["desktop-landscape"]);
    await page.goto(`${pageServer.baseUrl}/bst.html?book=${encodeURIComponent(`${bookOrigin}/expired.zip`)}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator(".empty-state")).toBeVisible();
    await expect(page.locator("#empty-state-message")).toContainText("returned 403", { timeout: 30_000 });
    await expect(page.locator("#empty-state-message")).toContainText("may have expired");
  });
});
