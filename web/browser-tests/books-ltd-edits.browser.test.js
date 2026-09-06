// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-ltd-edits.browser.test.js
//
// The Limited Company page's edit path, undo stack and settlement helper,
// driven through the page itself -- books-bst-edits.browser.test.js and
// books-se-edits.browser.test.js's own proofs, carried over to the four-file
// bank book and the payroll/business-details fields only a Company carries.
//
// No example is registered for Ltd yet (LT-T10), so the featured book
// reaches the page the way books-ltd-page.browser.test.js's own package
// does: a diya-gl zip built straight from examples/precision-code-ltd/full,
// dropped on the empty state.
//
// E1 anchors each edit in a figure the page renders (the P&L's own annual
// row, the Trial Balance's bank echo, OpenAccounts), and every edit's
// downloaded report.json is checked byte for byte against applyNamedEdit
// (bst/se's edits) or this file's own applyNamedLtdBookEdit (a book-field
// edit, which touches no line) running the same edit in Node over the same
// book. The page always resolves the year's rates through
// loadTaxDataForBook, so every Node-side comparison passes that in rather
// than the imprecise book.toml [tax] reading r-sources.js falls back to --
// books-se-edits.browser.test.js's own advancedTaxData() comment explains
// why the two would otherwise disagree on every depreciation-dependent cell.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { applyNamedEdit } from "./r-sources.js";
import { loadDiyaGlData, diyaGlToScenario } from "../../app/lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../../app/lib/diya-gl-calculator.js";
import { calculateExpectedTax } from "../../app/lib/tax/income-tax.js";
import { buildReportDocument, serializeReportDocument } from "../../app/lib/report-serializer.js";
import { productModule } from "../../app/lib/products.js";
import { loadTaxDataForBook } from "../../app/lib/product-workbook.js";
import { addSaleLine, addPurchaseLine } from "../../app/lib/diya-gl-edits.js";
import { changePayrollLine } from "../../app/lib/diya-gl-edits-ltd.js";

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

// ── Getting a book onto the page ───────────────────────────────────────────

async function diyaGlZipOf(bookDir) {
  const zip = new JSZip();
  zip.file("book.toml", fs.readFileSync(path.join(ROOT, bookDir, "book.toml")));
  zip.file("lines.jsonl", fs.readFileSync(path.join(ROOT, bookDir, "lines.jsonl")));
  zip.file("report.json", "{}\n");
  return zip.generateAsync({ type: "nodebuffer" });
}

// The same synthetic-drop upload books-se-equivalence.browser.test.js and
// books-ltd-page.browser.test.js both use: a File built from the zip
// bytes, dropped on the empty state, the same door the page's own diya-gl
// upload goes through.
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

// A fresh Ltd book carries no settlements at all, so one crafted half is the
// only suggestion of its kind on the card -- se-edits' own
// openNewSeBook/settleTestBook pattern, over Ltd's own new-book form.
async function openNewLtdBook(page, businessName) {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
  await page.goto(`${baseUrl}/books/ltd.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start a new book" }).click();
  await page.locator("#new-book-name").fill(businessName);
  await page.locator("#new-book-year-end").fill("2026-03-31");
  await page.getByRole("button", { name: "Create book" }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

// ── The Year view's entries grid ───────────────────────────────────────────

async function openView(page, viewId) {
  await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
  await expect(page.locator(`.tab-btn[data-view="${viewId}"]`)).toHaveAttribute("aria-selected", "true");
}

// April is the month the fixture opens on and carries entries for, so every
// hand edit below is made in a grid that is already showing.
async function openAprilEntries(page) {
  await openView(page, "year");
  const april = page.locator('.year-row[data-month="2025-04"]');
  if ((await april.getAttribute("aria-expanded")) !== "true") await april.click();
  const toggle = page.locator("#entries-toggle");
  if ((await toggle.innerText()).includes("Show entries")) await toggle.click();
  await expect(page.locator("table.entries-table")).toHaveCount(1);
}

async function switchJournal(page, journalId) {
  await page.locator(`.journal-switch-btn[data-journal-switch="${journalId}"]`).click();
  await expect(page.locator(`table.entries-table[data-journal="${journalId}"]`)).toBeVisible();
}

async function addEntry(page, journal, { date, account, detail, amount }) {
  const row = page.locator(`.entry-add-row[data-add-journal="${journal}"]`);
  if (date) await row.locator('[data-add-field="date"]').fill(date);
  if (account) await row.locator('[data-add-field="account"]').selectOption(account);
  if (detail) await row.locator('[data-add-field="detail"]').fill(detail);
  await row.locator('[data-add-field="amount"]').fill(String(amount));
  await row.locator("[data-add-entry]").click();
  await expect(page.locator(`.entry-add-row[data-add-journal="${journal}"] [data-add-field="amount"]`)).toHaveValue("");
}

async function allChecksPass(page) {
  await expect(page.locator("#inspector .check-item.fail")).toHaveCount(0);
}

// The engine checks' own failing set, read the same way
// books-warnings.browser.test.js's engineFailingSet does: every
// [data-r-key="check/<label>"] row carrying the fail class.
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

// book.debtors and (Ltd carries no equivalent for creditors) are separate,
// declarative registers no line edit writes to -- editing an existing
// receipt or adding a new sale moves the calculated trade debtors away from
// that static table's own closing figure, which is the one true mismatch
// such an edit leaves (settlement-helpers-ltd.test.js's own
// "sale-from-receipt"/"receipt-for-sale" cases document the same thing).
// This asserts no *other* check moved with it.
async function allChecksPassExcept(page, expectedFailingLabels) {
  await expect(page.locator("#inspector .book-checks-list .check-item.fail")).toHaveCount(0);
  expect(await engineFailingLabels(page)).toEqual(expectedFailingLabels.slice().sort());
}

async function undo(page) {
  await page.locator("#undo-btn").click();
}

// ── Reading a rendered figure back off the page ────────────────────────────
// The report the page just computed, read the same way
// books-warnings.browser.test.js's mileage test reads it: the live
// snapshot's own values array, not a second computation of this file's own.

async function reportValue(page, key) {
  return page.evaluate((key) => {
    const entry = window.DIYA_BOOKS_SNAPSHOT.report.values.find((v) => v.key === key);
    if (!entry) throw new Error(`no report value carries the key "${key}"`);
    return Number(entry.value);
  }, key);
}

const B9_SALES = "cell/Financialaccounts.xlsx!MnthP&L!B9";
const B45_NET_PROFIT = "cell/Financialaccounts.xlsx!MnthP&L!B45";
const B18_PAYE_WAGES = "cell/Financialaccounts.xlsx!MnthP&L!B18";
const EJ22_CURRENT_ACCOUNT = "cell/Financialaccounts.xlsx!TrialBalance!EJ22";
const E2_BUSINESS_NAME = "cell/Financialaccounts.xlsx!OpenAccounts!E2";

// The save menu's diya-gl zip download, captured and unzipped -- the same
// mechanism books-se-edits.browser.test.js and books-ltd-page.browser.test.js
// both use, kept local here so this file does not reach into another
// task's spec for a helper.
async function downloadDiyaGlReport(page) {
  await page.click("#save-btn");
  const item = page.getByRole("menuitem", { name: "Download books as diya-gl (.zip)", exact: true });
  await item.waitFor({ state: "visible" });
  const [download] = await Promise.all([page.waitForEvent("download"), item.click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  return zip.file("report.json").async("string");
}

// ── The year's rates, the way the page always resolves them ────────────────

let ltdTaxDataCache;
async function ltdTaxData() {
  if (!ltdTaxDataCache) {
    const { book } = loadDiyaGlData(path.resolve(ROOT, LTD_FULL_DIR));
    ltdTaxDataCache = await loadTaxDataForBook(book);
  }
  return ltdTaxDataCache;
}

// Finding (a)'s own comparison: applyNamedEdit (r-sources.js) only ever
// dispatches a line edit -- it always recalculates over the loaded book's
// own object, so a book-field edit (Business details' entity fields) has no
// way through it. This is the same shape, over a (book) => book edit
// instead, kept local rather than widening r-sources.js's own contract for
// every other spec that imports it.
function applyNamedLtdBookEdit(bookDir, bookEdit, taxData) {
  const { book, lines } = loadDiyaGlData(path.resolve(ROOT, bookDir));
  const newBook = bookEdit(book);
  const productMod = productModule("ltd");

  const scenario = diyaGlToScenario(newBook, lines, "ltd");
  const results = calculateFromDiyaGl(newBook, lines, "ltd", taxData, scenario);
  const mergedScenario = { ...scenario, ...scenario.expected };
  const periodEnd = newBook.documentInfo?.periodCoveredEnd;
  const yearEnd = periodEnd ? new Date(periodEnd).toISOString().slice(0, 10) : null;
  const checks = productMod.checkCompliance({ ...results }, mergedScenario, taxData, calculateExpectedTax, yearEnd);

  const document = buildReportDocument({
    packageName: "ltd",
    engine: "js",
    results,
    productMod,
    scenario: mergedScenario,
    checks,
    scenarioName: newBook.documentInfo?.entriesComment,
    yearEnd,
  });

  return { text: serializeReportDocument(document) };
}

// ============================== E1: edits proven against a rendered figure ==============================

test.describe("DIYA-GL Ltd page — E1: an edit moves the figure it should", () => {
  // Precision Code Ltd is VAT-registered, and the Sales sheet's own analysis
  // column strips VAT as a flat gross/1.2 from every turnover line
  // regardless of that line's own taxCode (diya-gl-loader.js's own comment
  // on computeSpreadsheetNetSales) -- so a £400 gross invoice raises the P&L
  // by its net, £333.33. book.debtors is a separate, declarative register no
  // line edit writes to (settlement-helpers-ltd.test.js's own comment on the
  // same fixture): a brand-new, never-banked sale parts it from the
  // calculated trade debtors by the invoice's own gross, the one check this
  // edit is expected to move.
  test("add a sale of X to Product A: browser and Node agree, and turnover and profit both rise by X net of VAT", async ({ page }) => {
    await openFull(page);
    await openAprilEntries(page);
    await switchJournal(page, "sales");

    const salesBefore = await reportValue(page, B9_SALES);
    const profitBefore = await reportValue(page, B45_NET_PROFIT);
    const netOfVat = 400 / 1.2;

    const line = {
      entryNumber: "NEW-0001",
      sourceJournalID: "sales",
      postingDate: "2025-04-20",
      accountMainID: "4000",
      amount: 400,
      documentType: "invoice",
      detailComment: "Extra Product A licence",
    };
    await addEntry(page, "sales", { date: line.postingDate, account: line.accountMainID, detail: line.detailComment, amount: line.amount });
    await expect(page.locator("#toast")).toContainText("Added a sales entry of £400.00");

    await expect.poll(() => reportValue(page, B9_SALES)).toBeCloseTo(salesBefore + netOfVat, 6);
    await expect.poll(() => reportValue(page, B45_NET_PROFIT)).toBeCloseTo(profitBefore + netOfVat, 6);
    await allChecksPassExcept(page, ["Published balance sheet: trade debtors = closing debtors"]);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(LTD_FULL_DIR, (book, lines) => addSaleLine(book, lines, { line }), "ltd", await ltdTaxData());
    expect(browserReport).toBe(nodeReport.text);
  });

  // The same flat gross/1.2 stripping as the sale above, on the purchases
  // side: a £250 gross invoice lowers the P&L by its net, £208.33. Unlike a
  // sale, this never touches book.debtors, and Ltd carries no equivalent
  // closing-creditors listing check (settlement-helpers-ltd.test.js's own
  // "purchase-from-payment" case notes the same asymmetry) -- every check
  // stays green.
  test("add a purchase of X to Advertising: browser and Node agree, and profit falls by X net of VAT with turnover unchanged", async ({
    page,
  }) => {
    await openFull(page);
    await openAprilEntries(page);
    await switchJournal(page, "purchases");

    const salesBefore = await reportValue(page, B9_SALES);
    const profitBefore = await reportValue(page, B45_NET_PROFIT);
    const netOfVat = 250 / 1.2;

    const line = {
      entryNumber: "NEW-0001",
      sourceJournalID: "purchases",
      postingDate: "2025-04-15",
      accountMainID: "5500",
      amount: 250,
      documentType: "invoice",
      detailComment: "Extra advertising",
    };
    await addEntry(page, "purchases", {
      date: line.postingDate,
      account: line.accountMainID,
      detail: line.detailComment,
      amount: line.amount,
    });
    await expect(page.locator("#toast")).toContainText("Added a purchases entry of £250.00");

    expect(await reportValue(page, B9_SALES)).toBe(salesBefore);
    await expect.poll(() => reportValue(page, B45_NET_PROFIT)).toBeCloseTo(profitBefore - netOfVat, 6);
    await allChecksPass(page);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(LTD_FULL_DIR, (book, lines) => addPurchaseLine(book, lines, { line }), "ltd", await ltdTaxData());
    expect(browserReport).toBe(nodeReport.text);
  });

  // TXN-0044: an Acme Corp receipt on the current account (1200) in April,
  // coded DR. Bumping a banked receipt's own amount raises the cash
  // received without touching the invoice it settles, so the calculated
  // trade debtors (invoiced less received) moves away from book.debtors'
  // own static closing figure by the same amount -- the one check this
  // edit is expected to move (the same asymmetry settlement-helpers-ltd.test.js's
  // "sale-from-receipt" and "receipt-for-sale" cases document).
  test("a bank receipt's amount (DR on 1200) moves the current account's own trial balance echo", async ({ page }) => {
    await openFull(page);
    await openAprilEntries(page);
    await switchJournal(page, "bank");

    const entryNumber = "TXN-0044";
    const delta = 250;
    const amountField = page.locator(`.entries-table[data-journal="bank"] tr.entry-row[data-entry="${entryNumber}"] .entry-amount-input`);
    const was = Number(await amountField.inputValue());
    expect(was).toBe(7200);
    const newAmount = was + delta;

    const currentAccountBefore = await reportValue(page, EJ22_CURRENT_ACCOUNT);
    await amountField.fill(String(newAmount));
    await amountField.press("Enter");
    await expect(page.locator("#toast")).toContainText("Changed " + entryNumber);

    await expect.poll(() => reportValue(page, EJ22_CURRENT_ACCOUNT)).toBe(currentAccountBefore + delta);
    await allChecksPassExcept(page, ["Published balance sheet: trade debtors = closing debtors"]);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(
      LTD_FULL_DIR,
      (book, lines) => lines.map((line) => (line.entryNumber === entryNumber ? { ...line, amount: newAmount } : line)),
      "ltd",
      await ltdTaxData(),
    );
    expect(browserReport).toBe(nodeReport.text);
  });

  // TXN-0026: a WorkSpace Ltd payment on the current account (1200) in
  // April, coded CR.
  test("a bank payment's amount (CR on 1200) moves the current account's own trial balance echo the other way", async ({ page }) => {
    await openFull(page);
    await openAprilEntries(page);
    await switchJournal(page, "bank");

    const entryNumber = "TXN-0026";
    const delta = 100;
    const amountField = page.locator(`.entries-table[data-journal="bank"] tr.entry-row[data-entry="${entryNumber}"] .entry-amount-input`);
    const was = Number(await amountField.inputValue());
    expect(was).toBe(1200);
    const newAmount = was + delta;

    const currentAccountBefore = await reportValue(page, EJ22_CURRENT_ACCOUNT);
    await amountField.fill(String(newAmount));
    await amountField.press("Enter");
    await expect(page.locator("#toast")).toContainText("Changed " + entryNumber);

    await expect.poll(() => reportValue(page, EJ22_CURRENT_ACCOUNT)).toBe(currentAccountBefore - delta);
    await allChecksPass(page);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(
      LTD_FULL_DIR,
      (book, lines) => lines.map((line) => (line.entryNumber === entryNumber ? { ...line, amount: newAmount } : line)),
      "ltd",
      await ltdTaxData(),
    );
    expect(browserReport).toBe(nodeReport.text);
  });

  // changePayrollLine (diya-gl-edits-ltd.js) recomputes net pay and the
  // line's own amount from gross, income tax and employee NI together --
  // more than the entries grid's lone amount field carries -- and no
  // Payroll view exists yet (LT-T8), so this reaches the book the way the
  // BST and SE suites already reach an edit with no dedicated grid
  // affordance: the page's own setLines seam. TXN-0074: Alice Johnson's
  // April salary, £3,500 gross, coded to 5101 (PAYE wages, MnthP&L!B18).
  test("changePayrollLine through setLines: browser and Node agree, and PAYE wages moves by the gross increase", async ({ page }) => {
    await openFull(page);

    const entryNumber = "TXN-0074";
    const delta = 300;
    const wagesBefore = await reportValue(page, B18_PAYE_WAGES);
    const profitBefore = await reportValue(page, B45_NET_PROFIT);

    const newGross = await page.evaluate(
      async ({ entryNumber, delta }) => {
        const snapshot = window.DIYA_BOOKS_SNAPSHOT;
        const line = snapshot.lines.find((l) => l.entryNumber === entryNumber);
        const newGross = line["diya-gl:grossPay"] + delta;
        const lines = snapshot.lines.map((l) => {
          if (l.entryNumber !== entryNumber) return l;
          const changed = { ...l, "diya-gl:grossPay": newGross };
          changed["diya-gl:netPay"] = newGross - changed["diya-gl:incomeTax"] - changed["diya-gl:employeeNI"];
          changed.amount = newGross;
          return changed;
        });
        await window.DiyaGlBooksPage.setLines(lines, "test: change payroll gross");
        return newGross;
      },
      { entryNumber, delta },
    );

    await expect.poll(() => reportValue(page, B18_PAYE_WAGES)).toBe(wagesBefore + delta);
    await expect.poll(() => reportValue(page, B45_NET_PROFIT)).toBe(profitBefore - delta);
    // changePayrollLine touches only this one line: the extra £300 of gross
    // (income tax and employee NI unchanged) raises net pay by the same
    // £300, but the aggregate "W"-coded bank line that pays the month's
    // payroll out never moves with it, so the whole-book audit total
    // (Trial Balance EJ91) is left exactly £300 short of zero -- the one
    // check a single-line payroll edit is expected to leave behind.
    await allChecksPassExcept(page, ["Trial Balance: audit accuracy (EJ91)"]);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(
      LTD_FULL_DIR,
      (book, lines) => changePayrollLine(book, lines, { entryNumber, grossPay: newGross }),
      "ltd",
      await ltdTaxData(),
    );
    expect(browserReport).toBe(nodeReport.text);
  });

  test("undo restores the downloaded report byte for byte", async ({ page }) => {
    await openFull(page);
    const before = await downloadDiyaGlReport(page);

    await openAprilEntries(page);
    await switchJournal(page, "bank");
    const entryNumber = "TXN-0044";
    const amountField = page.locator(`.entries-table[data-journal="bank"] tr.entry-row[data-entry="${entryNumber}"] .entry-amount-input`);
    const was = Number(await amountField.inputValue());
    await amountField.fill(String(was + 250));
    await amountField.press("Enter");
    await expect(page.locator("#toast")).toContainText("Changed " + entryNumber);

    const afterEdit = await downloadDiyaGlReport(page);
    expect(afterEdit).not.toBe(before);

    await undo(page);
    await expect(page.locator("#undo-btn")).toHaveClass(/hidden/);
    const afterUndo = await downloadDiyaGlReport(page);
    expect(afterUndo).toBe(before);
  });
});

// ============================== E1: the settlement helper ==============================

test.describe("DIYA-GL Ltd page — E1: the settlement helper previews then applies as one undo step", () => {
  test("make a sale from this receipt: a banked receipt with no sale behind it", async ({ page }) => {
    await openNewLtdBook(page, "Settlement Test Ltd");

    await page.evaluate(async () => {
      const snapshot = window.DIYA_BOOKS_SNAPSHOT;
      const newLine = {
        "entryNumber": "BREAK-SETTLE-SALE",
        "sourceJournalID": "bank",
        "postingDate": "2025-07-20",
        "accountMainID": "1200",
        "debitCreditCode": "D",
        "amount": 480,
        "documentType": "bank-statement",
        "documentReference": "BNK-SETTLE-1",
        "detailComment": "Acme Builders",
        "taxCode": "OS",
        "taxRate": 0,
        "diya-gl:bankCode": "DR",
        "diya-gl:bankAccountID": "1200",
      };
      await window.DiyaGlBooksPage.setLines(snapshot.lines.concat([newLine]), "test: append a crafted receipt");
    });

    await openView(page, "bank");
    const id = "sale-from-receipt:BREAK-SETTLE-SALE";
    const before = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.lines.length);

    // Preview alone changes nothing on the book.
    await page.locator(`[data-settlement-preview="${id}"]`).click();
    await expect(page.locator(".helper-changes li")).toContainText("sale 4000 — Sales Product A — £480.00 on 2025-07-20");
    expect(await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.lines.length)).toBe(before);

    // Apply is the one undoable step.
    await page.locator(`[data-settlement-apply="${id}"]`).click();
    await expect(page.locator("#toast")).toContainText("Added the missing half of " + id);
    await expect.poll(() => page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.lines.length)).toBe(before + 1);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(0);
    await allChecksPass(page);

    await undo(page);
    await expect.poll(() => page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.lines.length)).toBe(before);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(1);
  });
});

// ============================== finding (a): Business details' entity fields reach the calculator ==============================
// LT-T7's own remainder: E3/E4/J3/J4/N6/O3 edit the book through Business
// details' own fields (already wired -- helpers.bindBookFields), but the
// worry was whether diyaGlToScenario actually carries them from a live book
// into scenario.business the way it does E2/E8. Traced the loader
// (diya-gl-loader.js:324-334): it already builds business.company_number,
// .phone, .address, .town, .postcode and .utr off entityInformation for
// every product, the same object E2/E8 read -- confirmed by loading the
// fixture straight and reading scenario.business back before writing this
// spec. This is the regression proof, not a fix: an E1 case over the field
// the panel already exposes, checked byte for byte against Node.

async function reportTextValue(page, key) {
  return page.evaluate((key) => {
    const entry = window.DIYA_BOOKS_SNAPSHOT.report.values.find((v) => v.key === key);
    if (!entry) throw new Error(`no report value carries the key "${key}"`);
    return entry.value;
  }, key);
}

test.describe("DIYA-GL Ltd page — finding (a): the entity fields reach OpenAccounts", () => {
  test("editing the company name through Business details moves OpenAccounts!E2, byte for byte with Node", async ({ page }) => {
    await openFull(page);
    await openView(page, "business-details");

    expect(await reportTextValue(page, E2_BUSINESS_NAME)).toBe("Precision Code Ltd");
    const nameInput = page.locator('[data-book-field="organizationIdentifier"]');
    await expect(nameInput).toHaveValue("Precision Code Ltd");

    await nameInput.fill("New Name Ltd");
    await nameInput.dispatchEvent("change");
    await expect(page.locator("#toast")).toContainText("Changed");

    await expect.poll(() => reportTextValue(page, E2_BUSINESS_NAME)).toBe("New Name Ltd");
    await allChecksPass(page);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedLtdBookEdit(
      LTD_FULL_DIR,
      (book) => ({ ...book, entityInformation: { ...book.entityInformation, organizationIdentifier: "New Name Ltd" } }),
      await ltdTaxData(),
    );
    expect(browserReport).toBe(nodeReport.text);
  });

  // The other five fields the same finding named: each moves its own
  // OpenAccounts cell and nothing else about the entity path is special-cased
  // per field, so one further field stands for the rest rather than
  // repeating five near-identical byte-for-byte proofs.
  test("editing the company number moves OpenAccounts!E3", async ({ page }) => {
    await openFull(page);
    await openView(page, "business-details");

    expect(await reportTextValue(page, "cell/Financialaccounts.xlsx!OpenAccounts!E3")).toBe("12345678");
    const companyNumberInput = page.locator('[data-book-field="companyNumber"]');
    await companyNumberInput.fill("99999999");
    await companyNumberInput.dispatchEvent("change");
    await expect(page.locator("#toast")).toContainText("Changed");

    await expect.poll(() => reportTextValue(page, "cell/Financialaccounts.xlsx!OpenAccounts!E3")).toBe("99999999");
  });
});

// ============================== finding (c): Fixed assets' Class column ==============================
// ltd-ledger.js's renderFixedAssets printed asset.assetClass raw -- the
// book schema's own enum ("motorVehicles", "landBuildings"), never a label a
// reader would recognise. Fixed with a small local translation through
// SCHEDULE_ASSET_CLASSES' own labels (assetClassLabel, ltd-ledger.js).

test.describe("DIYA-GL Ltd page — finding (c): the Fixed assets Class column reads as a label", () => {
  test("the brought-forward table shows Schedule labels, not the book's own class enum", async ({ page }) => {
    await openFull(page);
    await openView(page, "fixed-assets");

    const rows = await page.locator("table.register-table tbody tr").allTextContents();
    const broughtForward = rows.slice(0, 3).join(" | ");
    expect(broughtForward).toContain("Motor vehicles");
    expect(broughtForward).toContain("Computer & technology");
    expect(broughtForward).toContain("Land & property");
    expect(broughtForward).not.toContain("motorVehicles");
    expect(broughtForward).not.toContain("computerTechnology");
    expect(broughtForward).not.toContain("landBuildings");
  });
});
