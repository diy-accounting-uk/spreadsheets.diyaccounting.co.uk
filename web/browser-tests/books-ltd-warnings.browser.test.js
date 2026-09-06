// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-ltd-warnings.browser.test.js
//
// E2 in PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md's T13: one case per Ltd rule in T5's
// table, each the same crafted change app/test/book-checks-ltd.test.js
// proves that rule breakable with, applied here through the page's own
// setLines/commitBook seam so the DOM's inspector proves what the Node suite
// already proved of the pure functions. Every test reads every one of the
// sixteen book-check ids before and after, so a crafted change that moves a
// rule it was not supposed to fails loudly rather than passing on a partial
// look, and the downloaded bookchecks.json is checked against the panel's
// own state for the id under test.
//
// Two further cases prove the engine checks a page edit can fail: E37 and
// D91 read the opening balance sheet, which the calculator builds from the
// book's own OB-001 opening-journal lines rather than book.openingBalances
// (LT-T7's own finding -- that field is never read), so these two edit
// through the opening lines themselves, the same setLines seam, rather than
// a book field a form could offer.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const ROOT = process.cwd();

const DESKTOP_LANDSCAPE = { width: 1440, height: 900 };
const LTD_FULL_DIR = "examples/precision-code-ltd/full";

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

// ── Getting the featured book onto the page ────────────────────────────────

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

async function openFull(page) {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
  await page.goto(`${baseUrl}/books/ltd.html`, { waitUntil: "domcontentloaded" });
  await dropFile(page, await diyaGlZipOf(LTD_FULL_DIR), "precision-code-ltd-full.zip");
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

async function appendLines(page, newLines) {
  await page.evaluate(async (newLines) => {
    const snapshot = window.DIYA_BOOKS_SNAPSHOT;
    await window.DiyaGlBooksPage.setLines(snapshot.lines.concat(newLines), "test: append a crafted line");
  }, newLines);
}

async function removeLineByEntryNumber(page, entryNumber) {
  await page.evaluate(async (entryNumber) => {
    const snapshot = window.DIYA_BOOKS_SNAPSHOT;
    await window.DiyaGlBooksPage.setLines(
      snapshot.lines.filter((line) => line.entryNumber !== entryNumber),
      "test: remove a line",
    );
  }, entryNumber);
}

// Replaces one line's own fields, by entryNumber, leaving every other line
// untouched. `patch` is plain data (Object.assign onto a copy of the line),
// not a function -- a field set to undefined is dropped, the same as
// deleting it.
async function patchLine(page, entryNumber, patch, label) {
  await page.evaluate(
    async ({ entryNumber, patch, label }) => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const lines = snapshot.lines.map((line) => {
        if (line.entryNumber !== entryNumber) return line;
        const changed = { ...line, ...patch };
        for (const key of Object.keys(patch)) {
          if (patch[key] === undefined) delete changed[key];
        }
        return changed;
      });
      await window.DiyaGlBooksPage.setLines(lines, label);
    },
    { entryNumber, patch, label },
  );
}

// The master fixture carries the cash top-up's own counter leg (TXN-0918)
// already (book-checks-ltd.test.js's own "the master itself carries the
// cash top-up's counter leg"), so the raw fixture is every rule's own clean
// baseline -- nothing to enter first.
async function openBaseline(page) {
  await openFull(page);
}

// ── Reading the book-checks panel ───────────────────────────────────────────
// Every book check and warning id the panel can show, in book-checks-ltd.test.js's
// own ALL_IDS order (the eight shared BST/SE rules, then the eight Ltd
// ones). book-empty-month carries no crafted case here either, the same way
// books-warnings.browser.test.js leaves it out for BST.

const SHARED_IDS = [
  "book-dates-in-period",
  "book-accounts-in-chart",
  "book-amounts-whole-pence",
  "book-vat-threshold",
  "book-duplicate-entries",
  "book-empty-detail",
  "book-negative-amount",
  "book-empty-month",
];
const LTD_IDS = [
  "book-ltd-bank-line-has-side",
  "book-ltd-bank-code-analysed",
  "book-ltd-straddling-line-has-vat-period",
  "book-ltd-payroll-line-names-employee",
  "book-ltd-fixed-asset-rows-fit-schedule",
  "book-ltd-transfer-has-counter-leg",
  "book-ltd-dividend-within-distributable-profits",
  "book-ltd-cis-on-subcontractor-line",
];
const ALL_IDS = SHARED_IDS.concat(LTD_IDS);

// Every book-check id's own verdict class, read straight off the DOM -- a
// passing row is still present (folded behind the passing disclosure), and
// the panel renders each id's row twice (open list, then again behind the
// disclosure), so this dedupes by simply overwriting per id.
async function bookCheckStates(page) {
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll("[data-book-check]").forEach((el) => {
      const id = el.getAttribute("data-book-check");
      out[id] = Array.from(el.classList).find((c) => c === "pass" || c === "warn" || c === "fail");
    });
    return out;
  });
}

function flippedIds(before, after) {
  return ALL_IDS.filter((id) => before[id] !== after[id]).sort();
}

function bookCheck(page, id) {
  return page.locator(`#inspector [data-book-check="${id}"]`);
}

// ── Reading the engine checks (checkCompliance) ─────────────────────────────

async function engineFailingLabels(page) {
  const items = page.locator("#inspector .checks-list .check-item.fail");
  const count = await items.count();
  const labels = [];
  for (let i = 0; i < count; i++) {
    const key = await items.nth(i).getAttribute("data-r-key");
    labels.push(
      String(key)
        .split(" || ")[0]
        .replace(/^check\//, ""),
    );
  }
  return labels.sort();
}

// ── The downloaded diya-gl zip's bookchecks.json ────────────────────────────

async function downloadBookChecksJson(page) {
  await page.click("#save-btn");
  const item = page.getByRole("menuitem", { name: "Download books as diya-gl (.zip)", exact: true });
  await item.waitFor({ state: "visible" });
  const [download] = await Promise.all([page.waitForEvent("download"), item.click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  return JSON.parse(await zip.file("bookchecks.json").async("string"));
}

async function undo(page) {
  await page.locator("#undo-btn").click();
}

// ============================== E2: each of T5's eight Ltd rules ==============================

test.describe("DIYA-GL Ltd page — E2: each of T5's Ltd rules flips on its own crafted change", () => {
  test("book-ltd-bank-line-has-side: a bank entry with no debit or credit code", async ({ page }) => {
    await openBaseline(page);
    const before = await bookCheckStates(page);

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const lines = snapshot.lines.map((line) => {
        if (line.entryNumber !== "TXN-0026") return line;
        const changed = { ...line };
        delete changed.debitCreditCode;
        return changed;
      });
      await window.DiyaGlBooksPage.setLines(lines, "test: drop TXN-0026's debitCreditCode");
    });

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-ltd-bank-line-has-side"]);
    await expect(bookCheck(page, "book-ltd-bank-line-has-side")).toHaveClass(/fail/);

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    expect(bookChecksJson.find((r) => r.id === "book-ltd-bank-line-has-side").result).toBe(panelState["book-ltd-bank-line-has-side"]);

    await undo(page);
    expect(flippedIds(before, await bookCheckStates(page))).toEqual([]);
  });

  test("book-ltd-bank-code-analysed: a cash receipt coded RV, which only the statement books analyse", async ({ page }) => {
    await openBaseline(page);
    const before = await bookCheckStates(page);

    await patchLine(
      page,
      "TXN-0026",
      { accountMainID: "1220", "diya-gl:bankAccountID": "1220", "diya-gl:bankCode": "RV", debitCreditCode: "D" },
      "test: recode TXN-0026 to RV on Cash",
    );

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-ltd-bank-code-analysed"]);
    await expect(bookCheck(page, "book-ltd-bank-code-analysed")).toHaveClass(/fail/);

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    expect(bookChecksJson.find((r) => r.id === "book-ltd-bank-code-analysed").result).toBe(panelState["book-ltd-bank-code-analysed"]);

    await undo(page);
    expect(flippedIds(before, await bookCheckStates(page))).toEqual([]);
  });

  test("book-ltd-transfer-has-counter-leg: the cash top-up's counter leg removed", async ({ page }) => {
    await openBaseline(page);
    const before = await bookCheckStates(page);

    await removeLineByEntryNumber(page, "TXN-0918");

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-ltd-transfer-has-counter-leg"]);
    await expect(bookCheck(page, "book-ltd-transfer-has-counter-leg")).toHaveClass(/warn/);

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    expect(bookChecksJson.find((r) => r.id === "book-ltd-transfer-has-counter-leg").result).toBe(
      panelState["book-ltd-transfer-has-counter-leg"],
    );

    await undo(page);
    expect(flippedIds(before, await bookCheckStates(page))).toEqual([]);
  });

  // TXN-0164: a purchase dated after the year end. Straddling into the next
  // year with no diya-gl:vatPeriodEnd fails both this rule and the shared
  // book-dates-in-period, which this rule's own offenders otherwise exempt.
  test("book-ltd-straddling-line-has-vat-period: a purchase after the year end with no VAT period", async ({ page }) => {
    await openBaseline(page);
    const before = await bookCheckStates(page);

    await patchLine(page, "TXN-0164", { postingDate: "2026-04-15" }, "test: move TXN-0164 past the year end");

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-dates-in-period", "book-ltd-straddling-line-has-vat-period"]);
    await expect(bookCheck(page, "book-ltd-straddling-line-has-vat-period")).toHaveClass(/fail/);
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/fail/);

    const check = bookCheck(page, "book-ltd-straddling-line-has-vat-period");
    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("date 2026-04-15 → 2026-03-31");
    await check.locator("[data-helper-apply]").click();
    await expect(bookCheck(page, "book-ltd-straddling-line-has-vat-period")).toHaveClass(/pass/);
    await expect(bookCheck(page, "book-dates-in-period")).toHaveClass(/pass/);

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    expect(bookChecksJson.find((r) => r.id === "book-ltd-straddling-line-has-vat-period").result).toBe(
      panelState["book-ltd-straddling-line-has-vat-period"],
    );

    await undo(page);
    expect(flippedIds(before, await bookCheckStates(page))).toEqual(["book-dates-in-period", "book-ltd-straddling-line-has-vat-period"]);
    await undo(page);
    expect(flippedIds(before, await bookCheckStates(page))).toEqual([]);
  });

  test("book-ltd-payroll-line-names-employee: a payslip for someone the book never employed", async ({ page }) => {
    await openBaseline(page);
    const before = await bookCheckStates(page);

    await patchLine(page, "TXN-0074", { "diya-gl:employeeID": "EMP999", detailComment: "Nobody" }, "test: reassign TXN-0074 to an unknown employee");

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-ltd-payroll-line-names-employee"]);
    await expect(bookCheck(page, "book-ltd-payroll-line-names-employee")).toHaveClass(/fail/);

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    expect(bookChecksJson.find((r) => r.id === "book-ltd-payroll-line-names-employee").result).toBe(
      panelState["book-ltd-payroll-line-names-employee"],
    );

    await undo(page);
    expect(flippedIds(before, await bookCheckStates(page))).toEqual([]);
  });

  test("book-ltd-dividend-within-distributable-profits: a dividend far above the year's profits", async ({ page }) => {
    await openBaseline(page);
    const before = await bookCheckStates(page);

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const nextBook = { ...snapshot.book, dividends: [{ ...snapshot.book.dividends[0], amount: 10000000 }] };
      await window.DiyaGlBooksPage.helpers.commitBook(nextBook, "test: a dividend far above profits", "Changed the dividend.");
    });

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-ltd-dividend-within-distributable-profits"]);
    await expect(bookCheck(page, "book-ltd-dividend-within-distributable-profits")).toHaveClass(/warn/);

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    expect(bookChecksJson.find((r) => r.id === "book-ltd-dividend-within-distributable-profits").result).toBe(
      panelState["book-ltd-dividend-within-distributable-profits"],
    );

    await undo(page);
    expect(flippedIds(before, await bookCheckStates(page))).toEqual([]);
  });

  test("book-ltd-cis-on-subcontractor-line: a CIS deduction on a materials purchase", async ({ page }) => {
    await openBaseline(page);
    const before = await bookCheckStates(page);

    await patchLine(page, "TXN-0042", { "diya-gl:cisDeduction": 100.0 }, "test: add a CIS deduction to a materials line");

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-ltd-cis-on-subcontractor-line"]);
    await expect(bookCheck(page, "book-ltd-cis-on-subcontractor-line")).toHaveClass(/warn/);

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    expect(bookChecksJson.find((r) => r.id === "book-ltd-cis-on-subcontractor-line").result).toBe(
      panelState["book-ltd-cis-on-subcontractor-line"],
    );

    await undo(page);
    expect(flippedIds(before, await bookCheckStates(page))).toEqual([]);
  });

  // The full fixture already carries five "fa"-mapped (5900) purchases
  // against the Schedule's eight new-asset rows -- book-checks-ltd.test.js's
  // own count -- so four more tips it over.
  test("book-ltd-fixed-asset-rows-fit-schedule: nine assets bought in a year with eight new-asset rows", async ({ page }) => {
    await openBaseline(page);
    const before = await bookCheckStates(page);

    const extra = [5, 6, 7, 8].map((i) => ({
      entryNumber: `BREAK-FA-${i}`,
      sourceJournalID: "purchases",
      postingDate: "2025-09-1" + (i % 10),
      accountMainID: "5900",
      amount: 1200.0 + i,
      detailComment: "Toolshed Ltd asset " + i,
      taxCode: "S",
      taxRate: 0.2,
    }));
    await appendLines(page, extra);

    const after = await bookCheckStates(page);
    expect(flippedIds(before, after)).toEqual(["book-ltd-fixed-asset-rows-fit-schedule"]);
    await expect(bookCheck(page, "book-ltd-fixed-asset-rows-fit-schedule")).toHaveClass(/fail/);

    const bookChecksJson = await downloadBookChecksJson(page);
    const panelState = await bookCheckStates(page);
    expect(bookChecksJson.find((r) => r.id === "book-ltd-fixed-asset-rows-fit-schedule").result).toBe(
      panelState["book-ltd-fixed-asset-rows-fit-schedule"],
    );

    await undo(page);
    expect(flippedIds(before, await bookCheckStates(page))).toEqual([]);
  });
});

// ============================== E2: the two editable engine checks ==============================
// E37 (Opening balance sheet: accuracy check) and D91 (Trial Balance:
// opening balances audit check) both read the opening balance sheet the
// calculator builds from the book's own OB-001 lines. Moving one OB-001
// line's amount, with nothing else in the opening journal to compensate,
// unbalances the opening sheet by the same amount -- which the whole
// book's own audit total (EJ91, tolerance zero) always catches too, since an
// opening imbalance is never corrected during the year. Directors loan
// (account 2500) carries no account-specific echo check of its own the way
// stock's opening figure does, so moving it by more than E37/D91's own
// tolerance (1) flips exactly these three engine checks and no book check.

test.describe("DIYA-GL Ltd page — E2: the two editable engine checks, through the opening lines", () => {
  test("E37 and D91: the directors loan's OB-001 line moved off balance", async ({ page }) => {
    await openFull(page);
    const engineBefore = await engineFailingLabels(page);
    expect(engineBefore).toEqual([]);
    const bookBefore = await bookCheckStates(page);

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const lines = snapshot.lines.map((line) =>
        line.entryNumber === "TXN-0010" && line.documentReference === "OB-001" ? { ...line, amount: line.amount + 100 } : line,
      );
      await window.DiyaGlBooksPage.setLines(lines, "test: move the directors loan's opening line off balance");
    });

    const engineAfter = await engineFailingLabels(page);
    expect(engineAfter).toEqual([
      "Opening balance sheet: accuracy check (E37)",
      "Trial Balance: audit accuracy (EJ91)",
      "Trial Balance: opening balances audit check (D91)",
    ]);

    // No book check moved: this is an engine-only defect, not one
    // book-checks.js's own rules catch.
    const bookAfter = await bookCheckStates(page);
    expect(bookAfter).toEqual(bookBefore);

    // The downloaded bookchecks.json agrees with the panel on every one of
    // the sixteen ids -- including the full fixture's own one pre-existing
    // warning (book-vat-threshold's turnover), which this edit never touches.
    const bookChecksJson = await downloadBookChecksJson(page);
    for (const id of ALL_IDS) {
      expect(bookChecksJson.find((r) => r.id === id).result, id).toBe(bookAfter[id]);
    }

    await undo(page);
    expect(await engineFailingLabels(page)).toEqual([]);
  });
});
