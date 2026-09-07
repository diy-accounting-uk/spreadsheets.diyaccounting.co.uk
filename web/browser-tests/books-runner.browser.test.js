// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-runner.browser.test.js
//
// The single-file HTML runner (scripts/build-runner.mjs), opened the way a
// customer would actually reach it: double-clicked from disk, no server, no
// network. Loads an example book, checks the year view carries real
// figures, and saves the diya-gl zip download -- the same three things
// books-bst.browser.test.js and books-save.browser.test.js already prove
// against the live server-hosted page, proven here with no origin at all.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

const ROOT = process.cwd();
const RUNNER_PATH = path.join(ROOT, "target", "runners", "diya-gl-bst.html");

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
    await page.click('#save-menu >> text=Download books as diya-gl (.zip)');
    await page.waitForEvent("download", { timeout: 30_000 }).then((d) => (download = d));

    expect(download, "the save menu's own download fired").not.toBeNull();
    const savePath = test.info().outputPath("runner-save.zip");
    await download.saveAs(savePath);

    const zip = await JSZip.loadAsync(fs.readFileSync(savePath));
    expect(Object.keys(zip.files).sort()).toEqual(["book.toml", "bookchecks.json", "lines.jsonl", "report.json"]);

    const bookToml = parseTOML(await zip.file("book.toml").async("string"));
    expect(bookToml.entityInformation.organizationIdentifier).toBe("Precision Code Trading");

    expect(consoleErrors, "the runner raised no console error or uncaught exception").toEqual([]);
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

    expect(consoleErrors, "the runner raised no console error or uncaught exception").toEqual([]);
  });
});
