// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-runner.browser.test.js
//
// The single-file HTML runner (scripts/build-runner.mjs), opened the way a
// customer would actually reach it: double-clicked from disk, no server, no
// network. Loads an example book, checks the year view carries real
// figures, and saves the diya-gl zip download -- the same three things
// diya-gl-bst.browser.test.js and diya-gl-save.browser.test.js already prove
// against the live server-hosted page, proven here with no origin at all.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

const ROOT = process.cwd();
const RUNNER_PATH = path.join(ROOT, "target", "runners", "diya-gl-bst.html");

// The runner's own newer-file check loads https://diya-gl.co.uk/build-stamp.js
// by a plain script tag from a file:// origin. Chromium logs one resource-load
// failure for that request on every run -- the offline case the notice's own
// equality test already tolerates, not a defect the runner raised. Which
// failure it logs depends on whether this environment's DNS resolves the
// host: name resolution failure where it does not, a same-origin block once
// it does (the host is a real, live site now, so the request reaches it and
// is then refused for crossing origins from file://).
const EXPECTED_STAMP_LOAD_FAILURES = [
  "Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
  "Failed to load resource: net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin",
];

function unexpectedConsoleErrors(consoleErrors) {
  return consoleErrors.filter((message) => !EXPECTED_STAMP_LOAD_FAILURES.includes(message));
}

test.describe("the DIYA-GL runner — opened from disk, no server", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(RUNNER_PATH)) {
      throw new Error(`No runner at ${RUNNER_PATH}. Run: npm run build:runners`);
    }
  });

  test("loads an example, shows the year's figures, and saves the diya-gl zip -- all offline", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    let download = null;
    page.on("download", (d) => (download = d));

    await page.goto(`file://${RUNNER_PATH}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/DIYA-GL — Basic Sole Trader.*offline runner/);

    await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    // The headline strip carries the example's own turnover figure, read
    // from the calculated report rather than a hand-typed cell -- a real
    // number, not a placeholder or a blank field.
    await expect(page.locator(".headlines-strip")).toContainText("£409,900.00");

    await page.click("#save-btn");
    await page.click("#save-menu >> text=Download books as diya-gl (.zip)");
    await page.waitForEvent("download", { timeout: 30_000 }).then((d) => (download = d));

    expect(download, "the save menu's own download fired").not.toBeNull();
    const savePath = test.info().outputPath("runner-save.zip");
    await download.saveAs(savePath);

    const zip = await JSZip.loadAsync(fs.readFileSync(savePath));
    expect(Object.keys(zip.files).sort()).toEqual(["book.toml", "bookchecks.json", "lines.jsonl", "report.json"]);

    const bookToml = parseTOML(await zip.file("book.toml").async("string"));
    expect(bookToml.entityInformation.organizationIdentifier).toBe("Precision Code Trading");

    expect(unexpectedConsoleErrors(consoleErrors), "the runner raised no console error or uncaught exception").toEqual([]);
  });

  test("the SA103S form view renders offline, off the product module's own direct fetch()", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto(`file://${RUNNER_PATH}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    await page.click("#sheet-tabs >> text=SA103S");
    await expect(page.locator("[data-r-key]").first()).toBeAttached({ timeout: 10_000 });

    expect(unexpectedConsoleErrors(consoleErrors), "the runner raised no console error or uncaught exception").toEqual([]);
  });
});

// The manifest the homepage's runner row reads (target/runners/runners.json)
// and the newer-file notice each runner carries once the site's own
// build-stamp.js is reachable -- proven here by routing that one script
// rather than standing up a real diya-gl.co.uk to answer it.
const RUNNERS_DIR = path.join(ROOT, "target", "runners");
const MANIFEST_PATH = path.join(RUNNERS_DIR, "runners.json");
const STAMP_KEYS = [
  "diya-gl:formatVersion",
  "diya-gl:engineVersion",
  "diya-gl:taxDataHash",
  "diya-gl:templateHash",
  "diya-gl:templateScorecard",
];

function embeddedRunnerStamp(runnerHtml) {
  const match = runnerHtml.match(/window\.DIYA_GL_RUNNER_STAMP\s*=\s*("(?:[^"\\]|\\.)*")/);
  if (!match) throw new Error("no window.DIYA_GL_RUNNER_STAMP literal found in the runner");
  return JSON.parse(match[1]);
}

test.describe("runners.json", () => {
  test("lists all four runners with a real byte count and every provenance stamp", () => {
    if (!fs.existsSync(MANIFEST_PATH)) {
      throw new Error(`No manifest at ${MANIFEST_PATH}. Run: npm run build:runners`);
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    expect(manifest).toHaveLength(4);
    for (const entry of manifest) {
      expect(entry.bytes).toBeGreaterThan(0);
      expect(entry.bytes).toBe(fs.statSync(path.join(RUNNERS_DIR, entry.file)).size);
      for (const key of STAMP_KEYS) expect(entry[key], key).toBeTruthy();
      if (Object.prototype.hasOwnProperty.call(entry, "diya-gl:reconciledCommit")) {
        expect(entry["diya-gl:reconciledCommit"]).toBeTruthy();
      }
    }
  });
});

test.describe("the runner's newer-file notice", () => {
  test("shows the notice with a link to the current runner when the site's stamp differs from the one embedded", async ({ page }) => {
    await page.route("**/build-stamp.js", (route) =>
      route.fulfill({ contentType: "application/javascript", body: 'self.DIYA_GL_BUILD_STAMP = "a-fabricated-different-stamp";' }),
    );

    await page.goto(`file://${RUNNER_PATH}`, { waitUntil: "domcontentloaded" });

    const notice = page.locator("#runner-update-notice");
    await expect(notice).toBeVisible();
    await expect(notice.locator("a")).toHaveAttribute("href", "https://diya-gl.co.uk/runners/diya-gl-bst.html");
  });

  test("shows no notice when the site's stamp matches the one embedded", async ({ page }) => {
    const runnerStamp = embeddedRunnerStamp(fs.readFileSync(RUNNER_PATH, "utf8"));
    await page.route("**/build-stamp.js", (route) =>
      route.fulfill({ contentType: "application/javascript", body: `self.DIYA_GL_BUILD_STAMP = ${JSON.stringify(runnerStamp)};` }),
    );

    await page.goto(`file://${RUNNER_PATH}`, { waitUntil: "domcontentloaded" });

    await expect(page.locator("#runner-update-notice")).toBeHidden();
  });
});
