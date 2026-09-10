// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-shell.browser.test.js
//
// The shared shell (diya-gl/shell.js) against the BST manifest it mounts
// (diya-gl/products/bst.js): the tab strip, the empty state and the new-book
// form come from the manifest and nothing else; rkFor derives the keys S2
// prints from CELL_MAP alone; a manifest with a view nothing renders is
// refused; a product with no manifest on the site is refused by name; the
// headlines strip is fed the snapshot's own report; the header's two
// book-level controls are New and Save, with no link off the page; and
// five fixes shared across every product page -- a button's hover text
// against its tint fill, a form row at a narrow width, the toast against
// the mobile action bar, the entries grid's column count by journal, and
// touch targets that reach 44px only at a coarse pointer.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";
import { s2 } from "./r-sources.js";
import { CELL_MAP } from "../../app/products/bst.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const screenshotsDir = path.join(process.cwd(), "reports/screenshots");
fs.mkdirSync(screenshotsDir, { recursive: true });
const PROFIT_BRIDGE_SECTION = "section/accounting-profit-to-tax-profit-bridge/";
const MOBILE_PORTRAIT = { width: 390, height: 844 };
const EXAMPLE_KEY = "bst-scenario-basic";

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
  return `${baseUrl}/diya-gl/bst.html${search || ""}`;
}

async function openEmptyPage(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await expect(page.locator(".empty-state")).toBeVisible();
}

async function openLoadedBook(page) {
  await openEmptyPage(page);
  await page.locator(`[data-example="${EXAMPLE_KEY}"]`).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

function businessName(page) {
  return page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.businessDetails.organizationIdentifier);
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

  test("the empty state's example buttons and the unknown-example message come from the product's example list", async ({ page }) => {
    await openEmptyPage(page);
    const buttonKeys = await page.locator("[data-example]").evaluateAll((buttons) => buttons.map((b) => b.getAttribute("data-example")));
    const manifestKeys = await page.evaluate(() => window.DiyaGlExamples[window.DiyaGlBooksPage.manifest.id].map((e) => e.key));
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

test.describe("DIYA-GL books shell — New sits beside Save", () => {
  test("neither product page links out to the download page", async ({ page }) => {
    for (const file of ["bst.html", "se.html"]) {
      await page.goto(`${baseUrl}/diya-gl/${file}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".app-topbar .app-mark")).toBeVisible();
      await expect(page.locator(".app-back")).toHaveCount(0);
      await expect(page.locator('a[href*="download.html"]')).toHaveCount(0);
      await expect(page.locator("#new-btn")).toHaveCount(1);
    }
  });

  test("New is enabled beside Save once a book is loaded, on desktop and on a phone", async ({ page }) => {
    await openEmptyPage(page);
    // Neither has anything to act on until a book is loaded.
    await expect(page.locator("#new-btn")).toBeHidden();
    await expect(page.locator("#save-btn")).toBeHidden();

    await page.locator(`[data-example="${EXAMPLE_KEY}"]`).click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    const newBtn = page.locator("#new-btn");
    const saveBtn = page.locator("#save-btn");
    await expect(newBtn).toBeVisible();
    await expect(newBtn).toBeEnabled();
    await expect(page.locator("#new-btn .btn-label")).toHaveText("New");

    // Same treatment as Save: the header's two book-level controls read as a
    // pair, not as a control and an afterthought.
    const style = (locator) =>
      locator.evaluate((el) => {
        const css = getComputedStyle(el);
        return { border: css.borderColor, background: css.backgroundColor, height: el.getBoundingClientRect().height };
      });
    expect(await style(newBtn)).toEqual(await style(saveBtn));
    const saveFollowsNew = await newBtn.evaluate(
      (el) => !!(el.compareDocumentPosition(document.getElementById("save-btn")) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    expect(saveFollowsNew).toBe(true);

    await page.setViewportSize(MOBILE_PORTRAIT);
    await expect(page.locator("#mobile-action-bar")).toBeVisible();
    const newMobile = page.locator("#new-btn-mobile");
    const saveMobile = page.locator("#save-btn-mobile");
    await expect(newMobile).toBeVisible();
    await expect(newMobile).toBeEnabled();

    // Equal prominence in the action bar: same fill, same width.
    const boxes = await Promise.all([newMobile.boundingBox(), saveMobile.boundingBox()]);
    expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThan(2);
    const fills = await Promise.all(
      [newMobile, saveMobile].map((locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor)),
    );
    expect(fills[0]).toBe(fills[1]);
  });

  test("New returns to the chooser, offering the book just left back", async ({ page }) => {
    await openLoadedBook(page);
    const loadedName = await businessName(page);

    await page.locator("#new-btn").click();

    await expect(page.locator(".empty-state")).toBeVisible();
    await expect(page.locator('label[for="file-picker"]')).toHaveText("Choose a file");
    await expect(page.locator("[data-example]").first()).toBeVisible();
    await expect(page.locator("#new-btn")).toBeHidden();
    await expect(page.locator("#save-btn")).toBeHidden();
    await expect(page.locator("#mobile-action-bar")).toBeHidden();

    const offer = page.locator(".continue-offer");
    await expect(offer).toBeVisible();
    await expect(offer).toContainText(EXAMPLE_KEY);

    await page.locator("#continue-btn").click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    expect(await businessName(page)).toBe(loadedName);
  });

  // A deep link never writes the autosave record, so this is the case where
  // the store holds nothing: the offer New leaves behind still restores the
  // book, which is why New discards nothing and asks nothing.
  test("New drops the deep-link parameters and still offers a book autosave never saw", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(bstUrl(`?example=${EXAMPLE_KEY}&view=year`), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    const loadedName = await businessName(page);
    expect(await page.evaluate(() => window.DiyaBooksAutosave.loadWorkingBook())).toBeFalsy();

    await page.locator("#new-btn").click();
    await expect(page.locator(".empty-state")).toBeVisible();

    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).pathname).toBe("/diya-gl/bst.html");

    await expect(page.locator(".continue-offer")).toContainText(EXAMPLE_KEY);
    await page.locator("#continue-btn").click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    expect(await businessName(page)).toBe(loadedName);
    // The book was never changed, so it is still the example the link
    // fetches and the address bar names it again.
    expect(new URL(page.url()).searchParams.get("example")).toBe(EXAMPLE_KEY);
  });

  test("the address bar names the example only while the book is still that example", async ({ page }) => {
    await openLoadedBook(page);
    expect(new URL(page.url()).searchParams.get("example")).toBe(EXAMPLE_KEY);

    await page.locator('.tab-btn[data-view="business-details"]').click();
    expect(new URL(page.url()).searchParams.get("view")).toBe("business-details");

    const name = page.locator('[data-book-field="organizationIdentifier"]');
    await name.fill("Precision Code Trading Ltd");
    await name.press("Enter");
    await expect(page.locator("#app-title")).toContainText("Precision Code Trading Ltd");

    // The link would fetch the example, and the screen is no longer it.
    expect(new URL(page.url()).search).toBe("");

    await page.locator("#undo-btn").click();
    await expect(page.locator("#app-title")).not.toContainText("Ltd");
    expect(new URL(page.url()).searchParams.get("example")).toBe(EXAMPLE_KEY);
  });

  test("an edited book keeps the address bar clear through New and continue", async ({ page }) => {
    await openLoadedBook(page);
    await page.locator('.tab-btn[data-view="business-details"]').click();
    const name = page.locator('[data-book-field="organizationIdentifier"]');
    await name.fill("Precision Code Trading Ltd");
    await name.press("Enter");
    await expect(page.locator("#app-title")).toContainText("Precision Code Trading Ltd");
    expect(new URL(page.url()).search).toBe("");

    await page.locator("#new-btn").click();
    await expect(page.locator(".continue-offer")).toBeVisible();
    await page.locator("#continue-btn").click();
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

    // Continue restores the edited book with an empty undo stack, and the
    // address bar still knows it is not the example.
    expect(await businessName(page)).toBe("Precision Code Trading Ltd");
    expect(await page.evaluate(() => window.DiyaGlBooksEdits.undo.depth())).toBe(0);
    expect(new URL(page.url()).search).toBe("");
  });

  test("the header and the chooser New returns to", async ({ page }) => {
    await openLoadedBook(page);
    const toast = page.locator("#toast");
    await expect(toast).not.toHaveClass(/is-visible/, { timeout: 15_000 });
    await page.locator(".app-topbar").screenshot({ path: path.join(screenshotsDir, "ui-1-header-desktop.png") });

    await page.setViewportSize(MOBILE_PORTRAIT);
    await expect(page.locator("#mobile-action-bar")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, "ui-1-header-mobile.png") });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator("#new-btn").click();
    await expect(page.locator(".continue-offer")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, "ui-1-empty-state-after-new.png") });
  });
});

test.describe("DIYA-GL books shell — cross-product contrast, layout and touch-target fixes", () => {
  function relativeLuminance([r, g, b]) {
    const channel = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }
  function contrastRatio(a, b) {
    const l1 = relativeLuminance(a) + 0.05;
    const l2 = relativeLuminance(b) + 0.05;
    return l1 > l2 ? l1 / l2 : l2 / l1;
  }

  test(".btn:hover keeps 4.5:1 text contrast against its tint fill, on every product page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const file of ["bst.html", "se.html", "ltd.html", "taxi.html"]) {
      await page.goto(`${baseUrl}/diya-gl/${file}`, { waitUntil: "domcontentloaded" });
      const btn = page.locator("#new-book-btn");
      await expect(btn, file).toBeVisible();
      await btn.hover();
      const colors = await btn.evaluate((el) => {
        const cs = getComputedStyle(el);
        const rgb = (text) =>
          text
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number);
        return { fg: rgb(cs.color), bg: rgb(cs.backgroundColor) };
      });
      expect(contrastRatio(colors.fg, colors.bg), `${file}: ${colors.fg.join(",")} on ${colors.bg.join(",")}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("a 390px form row wraps the label full width instead of squeezing it beside the money box, on SA103S, SA103F and CT600", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_PORTRAIT);
    const cases = [
      { file: "bst.html", example: "bst-scenario-basic", view: "sa103s" },
      { file: "se.html", example: "se-scenario-advanced", view: "sa103f" },
      { file: "ltd.html", example: "ltd-scenario-full", view: "ct600" },
    ];
    for (const c of cases) {
      await page.goto(`${baseUrl}/diya-gl/${c.file}?example=${c.example}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
      await page.locator(`.tab-btn[data-view="${c.view}"]`).click();
      await expect(page.locator(".form-row").first()).toBeAttached();
      const rows = await page.locator(".form-row").evaluateAll((rowEls) =>
        rowEls.map((row) => {
          const label = row.querySelector(".form-row-label");
          if (!label) return null;
          const lineHeight = parseFloat(getComputedStyle(label).lineHeight);
          return {
            width: label.getBoundingClientRect().width,
            lines: Math.round(label.getBoundingClientRect().height / lineHeight),
            rowRight: row.getBoundingClientRect().right,
          };
        }),
      );
      const withLabel = rows.filter(Boolean);
      // Every row's label gets the row's full width, not the ~130px column
      // that forced the longest labels to five lines, and the row never
      // pushes the money box past the viewport.
      for (const row of withLabel) {
        expect(row.width, `${c.file} ${c.view}`).toBeGreaterThan(260);
        expect(row.rowRight, `${c.file} ${c.view}`).toBeLessThanOrEqual(MOBILE_PORTRAIT.width);
      }
      // The turnover row is the note's own example: at the full label width
      // its text wraps to at most two lines, not five.
      expect(withLabel[0].lines, `${c.file} ${c.view} first row`).toBeLessThanOrEqual(2);
    }
    await page
      .locator(".form-section")
      .first()
      .screenshot({ path: path.join(screenshotsDir, "ui-2-form-row-390-after.png") });
  });

  test("the toast sits above the mobile action bar, never over New or Save", async ({ page }) => {
    await openLoadedBook(page);
    await page.setViewportSize(MOBILE_PORTRAIT);
    await expect(page.locator("#mobile-action-bar")).toBeVisible();
    await page.keyboard.press("Control+z"); // nothing to undo yet -- the toast fires synchronously
    const toast = page.locator("#toast");
    await expect(toast).toHaveClass(/is-visible/);
    const [toastBox, actionBarBox] = await Promise.all([toast.boundingBox(), page.locator("#mobile-action-bar").boundingBox()]);
    expect(toastBox.y + toastBox.height, "toast bottom edge clears the action bar's top").toBeLessThanOrEqual(actionBarBox.y);
    await page.screenshot({ path: path.join(screenshotsDir, "ui-2-toast-action-bar-after.png") });
  });

  async function entriesColumnsGeometry(page, file, example) {
    await page.goto(`${baseUrl}/diya-gl/${file}?example=${example}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    const toggle = page.locator("#entries-toggle");
    if ((await toggle.count()) === 0) {
      await page.locator(".year-table tbody tr.year-row").first().click();
    }
    await expect(toggle).toBeAttached();
    if ((await toggle.innerText()).includes("Show entries")) {
      await toggle.click();
    }
    return page.locator(".entries-columns").evaluate((el) => ({
      children: el.children.length,
      tracks: getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length,
    }));
  }

  test("entries-columns sizes by journal count: one journal takes the row, two share it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const se = await entriesColumnsGeometry(page, "se.html", "se-scenario-advanced");
    expect(se.children, "SE shows one of its five journals at a time").toBe(1);
    expect(se.tracks, "a single journal takes the whole row").toBe(1);

    const bst = await entriesColumnsGeometry(page, "bst.html", "bst-scenario-basic");
    expect(bst.children, "BST's two journals both show").toBe(2);
    expect(bst.tracks, "two journals share the row").toBe(2);
  });

  test.describe("coarse pointer", () => {
    test.use({ hasTouch: true });

    test("under-44px controls reach 44px at a coarse pointer", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${baseUrl}/diya-gl/bst.html?example=${EXAMPLE_KEY}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });

      const selectors = [
        ".year-row",
        ".all-categories-toggle",
        ".checks-passing > details > summary",
        ".headline-legend-item",
        ".headline-table-toggle",
        ".headline-through-year summary",
      ];
      for (const selector of selectors) {
        const el = page.locator(selector).first();
        await expect(el, selector).toBeAttached();
        const height = await el.evaluate((node) => node.getBoundingClientRect().height);
        expect(height, selector).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test("a fine pointer keeps the smaller desktop sizes the coarse-pointer media query never touches", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/diya-gl/bst.html?example=${EXAMPLE_KEY}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
    const height = await page
      .locator(".year-row")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeLessThan(44);
  });
});
