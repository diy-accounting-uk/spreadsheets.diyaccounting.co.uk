// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-shell.browser.test.js
//
// The shared shell (books/shell.js) against the BST manifest it mounts
// (books/products/bst.js): the tab strip, the empty state and the new-book
// form come from the manifest and nothing else; rkFor derives the keys S2
// prints from CELL_MAP alone; a manifest with a view nothing renders is
// refused; a product with no manifest on the site is refused by name; and
// the headlines strip is fed the snapshot's own report.

import { test, expect } from "@playwright/test";
import path from "node:path";
import { startStaticServer } from "./serve.js";
import { s2 } from "./r-sources.js";
import { CELL_MAP } from "../../app/products/bst.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const PROFIT_BRIDGE_SECTION = "section/accounting-profit-to-tax-profit-bridge/";

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

function bstUrl(search) {
  return `${baseUrl}/books/bst.html${search || ""}`;
}

async function openEmptyPage(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await expect(page.locator(".empty-state")).toBeVisible();
}

async function openLoadedBook(page) {
  await openEmptyPage(page);
  await page.locator('[data-example="bst-scenario-basic"]').click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

function parseMoney(text) {
  return Number(text.replace(/[£,\s]/g, ""));
}

test.describe("DIYA-GL books shell — the mounted manifest drives the page", () => {
  test("the tab strip lists the mounted manifest's views in order", async ({ page }) => {
    await openLoadedBook(page);
    const tabIds = await page.locator(".tab-btn[data-view]").evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-view")));
    const manifestIds = await page.evaluate(() => window.DiyaGlBooksPage.manifest.views.map((v) => v.id));
    expect(tabIds).toEqual(manifestIds);
    expect(manifestIds).toHaveLength(10);
    expect(await page.evaluate(() => window.DiyaGlBooksPage.manifest.id)).toBe("bst");
  });

  test("the empty state's example buttons and the unknown-example message come from the manifest", async ({ page }) => {
    await openEmptyPage(page);
    const buttonKeys = await page.locator("[data-example]").evaluateAll((buttons) => buttons.map((b) => b.getAttribute("data-example")));
    const manifestKeys = await page.evaluate(() => window.DiyaGlBooksPage.manifest.examples.map((e) => e.key));
    expect(buttonKeys).toEqual(manifestKeys);

    await page.goto(bstUrl("?example=nope"), { waitUntil: "domcontentloaded" });
    const message = page.locator("#empty-state-message");
    await expect(message).toHaveClass(/upload-error/);
    for (const key of manifestKeys) await expect(message).toContainText(key);
  });

  test("the new-book form renders the manifest's fields and builds a book of the manifest's product", async ({ page }) => {
    await openEmptyPage(page);
    await page.locator("#new-book-btn").click();
    await expect(page.locator("#new-book-form")).toBeVisible();

    const fields = await page.evaluate(() =>
      window.DiyaGlBooksPage.manifest.newBook.fields.map((f) => ({ id: f.id, label: f.label, name: f.name })),
    );
    const inputIds = await page.locator("#new-book-form input").evaluateAll((inputs) => inputs.map((input) => input.id));
    expect(inputIds).toEqual(fields.map((f) => f.id));
    for (const field of fields) {
      await expect(page.locator(`#new-book-form label[for="${field.id}"]`)).toHaveText(field.label);
    }

    await page.locator("#new-book-name").fill("Acorn Trading");
    await page.locator("#new-book-year-end").fill("2026-03-31");
    await page.getByRole("button", { name: "Create book" }).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    const built = await page.evaluate(() => ({
      product: window.DIYA_BOOKS_SNAPSHOT.book.entityInformation["diya-gl:product"],
      schemaName: window.DiyaGlBooksPage.manifest.schemaName,
      name: window.DIYA_BOOKS_SNAPSHOT.book.entityInformation.organizationIdentifier,
    }));
    expect(built.product).toBe(built.schemaName);
    expect(built.name).toBe("Acorn Trading");
  });

  test("rkFor gives every CELL_MAP row the cell key and the section key S2 prints", async ({ page }) => {
    await openLoadedBook(page);
    const s2Keys = new Set(s2("examples/precision-code-ltd/bst").keys());

    const derived = await page.evaluate(
      (rows) =>
        rows.map(([sheet, cell]) => {
          // rkFor returns the attribute as markup, so it is read back off an
          // element the way a view's own figure carries it.
          const holder = document.createElement("span");
          holder.innerHTML = "<i" + window.DiyaGlBooksPage.helpers.rkFor(sheet, cell) + "></i>";
          const raw = holder.firstChild.getAttribute("data-r-key");
          return { sheet, cell, keys: raw ? raw.split(" || ") : [] };
        }),
      CELL_MAP.map((row) => [row[0], row[1]]),
    );

    // Every row derives two keys, the cell key first.
    const derivedSections = new Set();
    let cellsInS2 = 0;
    for (const { sheet, cell, keys } of derived) {
      expect(keys, `${sheet}!${cell}`).toHaveLength(2);
      expect(keys[0]).toBe(`cell/${sheet}!${cell}`);
      expect(keys[1].startsWith("section/")).toBe(true);
      // S2 prints a row only when the cell has a value; where it does, the
      // row's section key must be the one S2 gives it.
      if (s2Keys.has(keys[0])) {
        cellsInS2++;
        expect(s2Keys.has(keys[1]), `${sheet}!${cell} -> ${keys[1]}`).toBe(true);
        derivedSections.add(keys[1]);
      }
    }
    expect(cellsInS2).toBeGreaterThan(100);

    // And S2's CELL_MAP-backed section keys are exactly the ones rkFor
    // derives: nothing S2 prints from CELL_MAP goes unkeyed.
    const s2Sections = [...s2Keys].filter((key) => key.startsWith("section/") && !key.startsWith(PROFIT_BRIDGE_SECTION));
    expect([...derivedSections].sort()).toEqual(s2Sections.sort());

    // A cell CELL_MAP does not name gives no key at all.
    expect(await page.evaluate(() => window.DiyaGlBooksPage.helpers.rkFor("Profit & Loss Acc", "Z99"))).toBe("");
  });

  test("a manifest view without a renderer is refused at mount", async ({ page }) => {
    await openLoadedBook(page);
    const outcome = await page.evaluate(() =>
      window.DiyaGlBooksPage.mount({ id: "broken", views: [{ id: "x", label: "X" }] }).then(
        () => ({ rejected: false }),
        (error) => ({ rejected: true, message: error.message, stillMounted: window.DiyaGlBooksPage.manifest.id }),
      ),
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain('"x"');
    expect(outcome.stillMounted).toBe("bst");
    await expect(page.locator(".tab-btn[data-view]")).toHaveCount(10);
  });

  test("loadManifest rejects for a product the site has no manifest for", async ({ page }) => {
    await openEmptyPage(page);
    const outcome = await page.evaluate(() =>
      window.DiyaGlBooksPage.loadManifest("nope").then(
        () => ({ rejected: false }),
        (error) => ({ rejected: true, message: error.message }),
      ),
    );
    expect(outcome.rejected).toBe(true);
    expect(outcome.message).toContain("products/nope.js");
    expect(await page.evaluate(() => window.DiyaGlBooksPage.manifest.id)).toBe("bst");
  });

  test("the headlines strip is fed the snapshot's own report", async ({ page }) => {
    await openLoadedBook(page);
    const fromReport = await page.evaluate(() => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const headlines = snapshot.context.engine.headlinesFromReport(snapshot.report, snapshot.context.productMod.HEADLINES);
      return headlines.tiles.turnover.value;
    });
    const tile = parseMoney(await page.locator('[data-r-key="headline/turnover"]').textContent());
    expect(tile).toBe(fromReport);
    expect(fromReport).toBeGreaterThan(0);
  });
});
