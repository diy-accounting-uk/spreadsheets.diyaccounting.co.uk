// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/books-se-edits.browser.test.js
//
// The Self Employed page's edit path, undo stack and book-check fix-its,
// driven through the page itself -- books-bst-edits.browser.test.js's own
// proofs, carried over to a nine-workbook, multi-journal book.
//
// E1 anchors each edit in a figure the page renders: a bank line's amount
// has to move the bank book's own closing balance by exactly the
// difference, a payroll line's gross has to move the wages interface and
// the P&L wages row, and undo has to bring the downloaded report back byte
// for byte. E2 flips each of T5's ten Self Employed rules by the same
// deliberate change the Node suite proves it with, on
// examples/brickwork-pro/se-nonvat -- the book those crafted changes were
// written against -- dropped onto the page as a diya-gl zip exactly the way
// books-se-equivalence.browser.test.js already does for the two BrickWork
// books. Each settlement helper gets its own book, started from nothing on
// the page's own new-book form, so its one crafted half is the only
// suggestion on the card.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { applyNamedEdit, parseFigure } from "./r-sources.js";
import { loadDiyaGlData } from "../../app/lib/diya-gl-loader.js";
import { changeLineAmount } from "../../app/lib/diya-gl-edits.js";
import { loadTaxDataForBook } from "../../app/lib/product-workbook.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const ROOT = process.cwd();

const DESKTOP_LANDSCAPE = { width: 1440, height: 900 };

const SE_ADVANCED_DIR = "examples/precision-code-ltd/advanced";
const SE_NONVAT_DIR = "examples/brickwork-pro/se-nonvat";

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

async function openAdvanced(page) {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
  await page.goto(`${baseUrl}/books/se.html?example=se-scenario-advanced`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 30_000 });
}

// The two BrickWork books carry no example button (r-sources.js's
// SCENARIOS_SE marks them `example: null`), so they reach the page the same
// door books-se-equivalence.browser.test.js already proved: a diya-gl zip
// built straight from the directory, dropped on the empty state.
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

async function openSeNonVat(page) {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
  await page.goto(`${baseUrl}/books/se.html`, { waitUntil: "domcontentloaded" });
  await dropFile(page, await diyaGlZipOf(SE_NONVAT_DIR), "se-nonvat-diya-gl.zip");
  await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 30_000 });
}

// The four settlement helpers each need a book with exactly one unsettled
// half, and both example books already carry dozens (the settlements card
// shows at most eight), so a settlement proof starts from nothing on the
// page's own new-book form instead.
async function openNewSeBook(page, businessName) {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
  await page.goto(`${baseUrl}/books/se.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start a new book" }).click();
  await page.locator("#new-book-name").fill(businessName);
  await page.locator("#new-book-year-end").fill("2026-03-31");
  await page.getByRole("button", { name: "Create book" }).click();
  await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 30_000 });
}

// ── Reading a rendered figure back off the page ────────────────────────────

// A figure's own data-r-key attribute is not always a lone report key: a
// cell that is also one of the headline strip's own figures carries both,
// joined " || " (T7's own convention -- books-se-equivalence.browser.test.js's
// collectRenderedFigures splits the same way), so this reads by membership
// in that split list rather than by an exact attribute match.
async function cellValue(page, key) {
  const text = await page.evaluate((key) => {
    const el = Array.from(document.querySelectorAll("[data-r-key]")).find((candidate) =>
      candidate.getAttribute("data-r-key").split(" || ").includes(key),
    );
    if (!el) throw new Error(`no element carries the report key "${key}"`);
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ? el.value : el.textContent;
  }, key);
  return parseFigure(text).value;
}

async function openView(page, viewId) {
  await page.locator(`.tab-btn[data-view="${viewId}"]`).click();
  await expect(page.locator(`.tab-btn[data-view="${viewId}"]`)).toHaveAttribute("aria-selected", "true");
}

async function openMonthEntries(page, monthKey) {
  await openView(page, "year");
  const row = page.locator(`.year-row[data-month="${monthKey}"]`);
  if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
  const toggle = page.locator("#entries-toggle");
  if ((await toggle.innerText()).includes("Show entries")) await toggle.click();
  await expect(page.locator("table.entries-table")).toHaveCount(1);
}

async function switchJournal(page, journalId) {
  await page.locator(`.journal-switch-btn[data-journal-switch="${journalId}"]`).click();
  await expect(page.locator(`table.entries-table[data-journal="${journalId}"]`)).toBeVisible();
}

async function allChecksPass(page) {
  await expect(page.locator("#inspector .check-item.fail")).toHaveCount(0);
}

function bookCheck(page, id) {
  return page.locator(`#inspector [data-book-check="${id}"]`);
}

// Every book-check id's own verdict class, read straight off the DOM --
// a passing row is still present (folded behind the passing disclosure),
// so this sees all sixteen whichever way the panel is open.
async function ruleStates(page) {
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll("[data-book-check]").forEach((el) => {
      const id = el.getAttribute("data-book-check");
      out[id] = Array.from(el.classList).find((c) => c === "pass" || c === "warn" || c === "fail");
    });
    return out;
  });
}

async function ruleState(page, id) {
  return (await ruleStates(page))[id];
}

// Every rule but the one named keeps the verdict `before` recorded for it --
// one crafted change, one flipped rule, nothing else moves.
function assertOnlyThisRuleFlips(before, after, targetId) {
  for (const id of Object.keys(before)) {
    if (id === targetId) continue;
    expect(after[id], id).toBe(before[id]);
  }
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

async function undo(page) {
  await page.locator("#undo-btn").click();
}

// The save menu's diya-gl zip download, captured and unzipped -- the same
// mechanism books-se-equivalence.browser.test.js uses for A1/A2, kept local
// here so this file does not reach into another task's spec for a helper.
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

// ============================== E1: edits proven against a rendered figure ==============================

// The page always resolves the year's rates through loadTaxDataForBook (the
// resource loader reading app/data/se-2025-2026.toml), which carries a
// capital_allowances/depreciation section extractTaxDataFromBook's bare
// book.toml reading does not -- extractTaxDataFromBook builds that shape
// for "ltd" only (T11's board row SE-T17). Passing the real rates in here
// is what makes applyNamedEdit's report agree with the page's byte for byte;
// without it, every depreciation-dependent figure disagrees regardless of
// the edit under test.
let advancedTaxDataCache;
async function advancedTaxData() {
  if (!advancedTaxDataCache) {
    const { book } = loadDiyaGlData(path.resolve(ROOT, SE_ADVANCED_DIR));
    advancedTaxDataCache = await loadTaxDataForBook(book);
  }
  return advancedTaxDataCache;
}

test.describe("DIYA-GL Self Employed page — E1: an edit moves the figure it should", () => {
  test("a bank line's amount moves the bank book's March closing balance by the difference, engine checks stay green", async ({ page }) => {
    await openAdvanced(page);

    await openView(page, "bank");
    const closingBefore = await cellValue(page, "cell/Bank.xlsx!Mar!A2");

    // TXN-0059: a receipt on the current account in April.
    const entryNumber = "TXN-0059";
    const delta = 250;
    await openMonthEntries(page, "2025-04");
    await switchJournal(page, "bank");
    const amountField = page.locator(`.entries-table[data-journal="bank"] tr.entry-row[data-entry="${entryNumber}"] .entry-amount-input`);
    const was = Number(await amountField.inputValue());
    const newAmount = was + delta;
    await amountField.fill(String(newAmount));
    await amountField.press("Enter");
    await expect(page.locator("#toast")).toContainText("Changed " + entryNumber);

    await openView(page, "bank");
    await expect.poll(() => cellValue(page, "cell/Bank.xlsx!Mar!A2")).toBe(closingBefore + delta);
    await allChecksPass(page);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(
      SE_ADVANCED_DIR,
      (book, lines) => lines.map((line) => (line.entryNumber === entryNumber ? { ...line, amount: newAmount } : line)),
      "se",
      await advancedTaxData(),
    );
    expect(browserReport).toBe(nodeReport.text);
  });

  // Wagesinterface reads a payroll line's diya-gl:grossPay field, not its
  // amount (diya-gl-loader.js: grossPay = line["diya-gl:grossPay"] ||
  // line.amount), and every payroll line in this book carries that field --
  // so this edit goes through the page's own setLines seam, the way the
  // BST suite already reaches a change with no dedicated grid affordance.
  test("an edited payroll gross moves Wagesinterface's April column and the P&L wages row", async ({ page }) => {
    await openAdvanced(page);

    await openView(page, "payroll");
    const wagesBefore = await cellValue(page, "cell/Financialaccounts.xlsx!Wagesinterface!C4");
    await openView(page, "profit-loss");
    const plWagesBefore = await cellValue(page, "cell/Financialaccounts.xlsx!Profit & Loss Account!B21");

    const entryNumber = "TXN-0074"; // Alice Johnson, April salary, grossPay 3500.
    const delta = 300;
    const newGross = 3500 + delta;
    await page.evaluate(
      async ({ entryNumber, newGross }) => {
        const snapshot = window.DIYA_BOOKS_SNAPSHOT;
        const lines = snapshot.lines.map((line) => (line.entryNumber === entryNumber ? { ...line, "diya-gl:grossPay": newGross } : line));
        await window.DiyaGlBooksPage.setLines(lines, "test: change payroll gross");
      },
      { entryNumber, newGross },
    );

    await openView(page, "payroll");
    await expect.poll(() => cellValue(page, "cell/Financialaccounts.xlsx!Wagesinterface!C4")).toBe(wagesBefore + delta);
    await openView(page, "profit-loss");
    await expect.poll(() => cellValue(page, "cell/Financialaccounts.xlsx!Profit & Loss Account!B21")).toBe(plWagesBefore + delta);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(
      SE_ADVANCED_DIR,
      (book, lines) => lines.map((line) => (line.entryNumber === entryNumber ? { ...line, "diya-gl:grossPay": newGross } : line)),
      "se",
      await advancedTaxData(),
    );
    expect(browserReport).toBe(nodeReport.text);
  });

  // The entries grid's own amount field reaches changeLineAmount
  // (diya-gl-edits.js), not the grossPay-only edit above. Every payroll line
  // the exporter writes carries amount === diya-gl:grossPay
  // (xlsx-exporter.js), so changeLineAmount keeps the two fields together --
  // otherwise this edit would report as applied while the wages interface
  // and the P&L wages row, both keyed off diya-gl:grossPay, stayed put.
  test("the grid's own amount field on a payroll line also moves its gross, Wagesinterface and the P&L wages row", async ({ page }) => {
    await openAdvanced(page);

    await openView(page, "payroll");
    const wagesBefore = await cellValue(page, "cell/Financialaccounts.xlsx!Wagesinterface!C4");
    await openView(page, "profit-loss");
    const plWagesBefore = await cellValue(page, "cell/Financialaccounts.xlsx!Profit & Loss Account!B21");

    const entryNumber = "TXN-0074"; // Alice Johnson, April salary, amount and grossPay both 3500.
    const delta = 300;
    await openMonthEntries(page, "2025-04");
    await switchJournal(page, "payroll");
    const amountField = page.locator(
      `.entries-table[data-journal="payroll"] tr.entry-row[data-entry="${entryNumber}"] .entry-amount-input`,
    );
    const was = Number(await amountField.inputValue());
    const newAmount = was + delta;
    await amountField.fill(String(newAmount));
    await amountField.press("Enter");
    await expect(page.locator("#toast")).toContainText("Changed " + entryNumber);

    await openView(page, "payroll");
    await expect.poll(() => cellValue(page, "cell/Financialaccounts.xlsx!Wagesinterface!C4")).toBe(wagesBefore + delta);
    await openView(page, "profit-loss");
    await expect.poll(() => cellValue(page, "cell/Financialaccounts.xlsx!Profit & Loss Account!B21")).toBe(plWagesBefore + delta);

    const browserReport = await downloadDiyaGlReport(page);
    const nodeReport = applyNamedEdit(
      SE_ADVANCED_DIR,
      (book, lines) => changeLineAmount(book, lines, { entryNumber, newAmount }),
      "se",
      await advancedTaxData(),
    );
    expect(browserReport).toBe(nodeReport.text);
  });

  test("undo restores the downloaded report byte for byte", async ({ page }) => {
    await openAdvanced(page);
    const before = await downloadDiyaGlReport(page);

    const entryNumber = "TXN-0059";
    await openMonthEntries(page, "2025-04");
    await switchJournal(page, "bank");
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

// ============================== E1: a line added through the grid's own Add button ==============================
// T37b renders the add row off the journal's own descriptor, T37c routes
// addEntry on its kind, and T37d declares the three SE descriptors. This is
// the proof that the three together actually land a line when a reader
// drives the row itself, rather than through setLines.

function addRow(page, journal) {
  return page.locator(`.entries-table[data-journal="${journal}"] .entry-add-row`);
}

async function fillAddRow(page, journal, fields) {
  const row = addRow(page, journal);
  for (const [name, value] of Object.entries(fields)) {
    const field = row.locator(`[data-add-field="${name}"]`);
    const tagName = await field.evaluate((el) => el.tagName);
    if (tagName === "SELECT") await field.selectOption(String(value));
    else await field.fill(String(value));
  }
  return row;
}

async function clickAdd(page, journal) {
  await addRow(page, journal).locator("[data-add-entry]").click();
}

async function newestLine(page) {
  return page.evaluate(() => {
    const lines = window.DIYA_BOOKS_SNAPSHOT.lines;
    return lines[lines.length - 1];
  });
}

test.describe("DIYA-GL Self Employed page — E1: a line added through the grid's own Add button", () => {
  test("a bank receipt lands through the Add button, the new row carries the typed figures, and the checks stay green", async ({
    page,
  }) => {
    await openAdvanced(page);
    await openMonthEntries(page, "2025-04");
    await switchJournal(page, "bank");
    const before = await lineCount(page);

    await fillAddRow(page, "bank", { date: "2025-04-15", account: "1200", direction: "D" });
    await fillAddRow(page, "bank", { code: "DR", detail: "Recruit-a-Coder plc", amount: "120.00" });
    await clickAdd(page, "bank");
    await expect(page.locator("#toast")).toContainText("Added a bank entry of £120.00");

    await expect.poll(() => lineCount(page)).toBe(before + 1);
    const newRow = page.locator('.entries-table[data-journal="bank"] tr.entry-row[data-entry="NEW-0001"]');
    await expect(newRow.locator(".entry-amount-input")).toHaveValue("120.00");
    await expect(newRow.locator(".entry-account-select")).toHaveValue("1200");
    await expect(newRow.locator(".entry-detail")).toHaveText("Recruit-a-Coder plc");

    const line = await newestLine(page);
    expect(line).toMatchObject({
      "entryNumber": "NEW-0001",
      "sourceJournalID": "bank",
      "accountMainID": "1200",
      "diya-gl:bankAccountID": "1200",
      "debitCreditCode": "D",
      "diya-gl:bankCode": "DR",
      "amount": 120,
    });

    await allChecksPass(page);
  });

  test("a cash payment lands through the Add button, the cash journal's line count rises by one, and the checks stay green", async ({
    page,
  }) => {
    await openAdvanced(page);
    await openMonthEntries(page, "2025-04");
    await switchJournal(page, "cash");
    const before = await lineCount(page);
    const cashLinesBefore = await page.locator('.entries-table[data-journal="cash"] tr.entry-row').count();

    await fillAddRow(page, "cash", { date: "2025-04-18", direction: "C" });
    await fillAddRow(page, "cash", { code: "CR", detail: "Petty cash float top-up", amount: "15.00" });
    await clickAdd(page, "cash");
    await expect(page.locator("#toast")).toContainText("Added a cash entry of £15.00");

    await expect.poll(() => lineCount(page)).toBe(before + 1);
    await expect(page.locator('.entries-table[data-journal="cash"] tr.entry-row')).toHaveCount(cashLinesBefore + 1);
    const newRow = page.locator('.entries-table[data-journal="cash"] tr.entry-row[data-entry="NEW-0001"]');
    await expect(newRow.locator(".entry-amount-input")).toHaveValue("15.00");
    await expect(newRow.locator(".entry-account-select")).toHaveValue("1220");

    const line = await newestLine(page);
    expect(line).toMatchObject({
      "entryNumber": "NEW-0001",
      "sourceJournalID": "bank",
      "accountMainID": "1220",
      "diya-gl:bankAccountID": "1220",
      "debitCreditCode": "C",
      "diya-gl:bankCode": "CR",
      "amount": 15,
    });

    await allChecksPass(page);
  });

  test("a payslip lands through the Add button, its net is gross minus tax minus employee NI, and the checks stay green", async ({
    page,
  }) => {
    await openAdvanced(page);
    await openMonthEntries(page, "2025-04");
    await switchJournal(page, "payroll");
    const before = await lineCount(page);

    const gross = 1000;
    const incomeTax = 150;
    const employeeNI = 80;
    const employerNI = 95;
    await fillAddRow(page, "payroll", { date: "2025-04-25", account: "5101", employee: "EMP001" });
    await fillAddRow(page, "payroll", {
      incomeTax: String(incomeTax),
      employeeNI: String(employeeNI),
      employerNI: String(employerNI),
      amount: String(gross),
    });
    await clickAdd(page, "payroll");
    await expect(page.locator("#toast")).toContainText("Added a payroll entry of £1,000.00");

    await expect.poll(() => lineCount(page)).toBe(before + 1);
    const newRow = page.locator('.entries-table[data-journal="payroll"] tr.entry-row[data-entry="NEW-0001"]');
    await expect(newRow.locator(".entry-amount-input")).toHaveValue(gross.toFixed(2));
    await expect(newRow.locator(".entry-account-select")).toHaveValue("5101");
    await expect(newRow.locator(".entry-detail")).toHaveText("Alice Johnson");

    const line = await newestLine(page);
    expect(line).toMatchObject({
      "entryNumber": "NEW-0001",
      "sourceJournalID": "payroll",
      "accountMainID": "5101",
      "diya-gl:employeeID": "EMP001",
      "diya-gl:grossPay": gross,
      "diya-gl:incomeTax": incomeTax,
      "diya-gl:employeeNI": employeeNI,
      "diya-gl:employerNI": employerNI,
      "diya-gl:netPay": gross - incomeTax - employeeNI,
      "amount": gross,
    });

    await allChecksPass(page);
  });

  test("undo removes the line an Add button just landed", async ({ page }) => {
    await openAdvanced(page);
    await openMonthEntries(page, "2025-04");
    await switchJournal(page, "bank");
    const before = await lineCount(page);

    await fillAddRow(page, "bank", { date: "2025-04-16", account: "1200", direction: "D" });
    await fillAddRow(page, "bank", { code: "DR", detail: "Undo proof receipt", amount: "75.00" });
    await clickAdd(page, "bank");
    await expect.poll(() => lineCount(page)).toBe(before + 1);

    await undo(page);
    await expect.poll(() => lineCount(page)).toBe(before);
    await expect(page.locator('.entries-table[data-journal="bank"] tr.entry-row[data-entry="NEW-0001"]')).toHaveCount(0);
  });

  test("changing an existing bank line's account through the grid's select moves both accountMainID and diya-gl:bankAccountID", async ({
    page,
  }) => {
    await openAdvanced(page);
    await openMonthEntries(page, "2025-04");
    await switchJournal(page, "bank");

    const entryNumber = "TXN-0059"; // a receipt on 1200 in April.
    const select = page.locator(`.entry-account-select[data-account-entry="${entryNumber}"]`);
    await expect(select).toHaveValue("1200");

    await select.selectOption("1220");
    await expect(page.locator("#toast")).toContainText("Changed " + entryNumber + "'s account to 1220");

    const line = await page.evaluate(
      (entryNumber) => window.DIYA_BOOKS_SNAPSHOT.lines.find((line) => line.entryNumber === entryNumber),
      entryNumber,
    );
    expect(line.accountMainID).toBe("1220");
    expect(line["diya-gl:bankAccountID"]).toBe("1220");

    await undo(page);
    const restored = await page.evaluate(
      (entryNumber) => window.DIYA_BOOKS_SNAPSHOT.lines.find((line) => line.entryNumber === entryNumber),
      entryNumber,
    );
    expect(restored.accountMainID).toBe("1200");
    expect(restored["diya-gl:bankAccountID"]).toBe("1200");
  });
});

// ============================== E2: the ten Self Employed rules, each broken its own way ==============================
// examples/brickwork-pro/se-nonvat is the book app/test/book-checks-se.test.js
// crafts these same ten changes against; every mutation below is that same
// change, applied here through the page's own setLines seam so the DOM's
// inspector proves what the Node suite already proved of the pure functions.

test.describe("DIYA-GL Self Employed page — E2: each rule flips on its own crafted change", () => {
  test("book-bank-account-has-workbook: a bank line on an account the package keeps no workbook for", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-bank-account-has-workbook";
    const before = await ruleStates(page);

    await appendLines(page, [
      {
        "entryNumber": "BREAK-BANK-ACCOUNT",
        "sourceJournalID": "bank",
        "postingDate": "2025-07-15",
        "accountMainID": "1210",
        "debitCreditCode": "D",
        "amount": 500,
        "documentType": "bank-statement",
        "documentReference": "BNK-BREAK-1",
        "detailComment": "Savings account interest",
        "taxCode": "OS",
        "taxRate": 0,
        "diya-gl:bankCode": "DR",
        "diya-gl:bankAccountID": "1210",
      },
    ]);
    await expect.poll(() => ruleState(page, id)).toBe("fail");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);

    const check = bookCheck(page, id);
    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("account 1210 → 1200 — Current account");
    await check.locator("[data-helper-apply]").click();
    await expect.poll(() => ruleState(page, id)).toBe("pass");
    await allChecksPass(page);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("fail");
  });

  test("book-bank-code-analysed: a receipt coded Q, which no Bank.xlsx column analyses", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-bank-code-analysed";
    const before = await ruleStates(page);

    await appendLines(page, [
      {
        "entryNumber": "BREAK-BANK-CODE",
        "sourceJournalID": "bank",
        "postingDate": "2025-07-16",
        "accountMainID": "1200",
        "debitCreditCode": "D",
        "amount": 500,
        "documentType": "bank-statement",
        "documentReference": "BNK-BREAK-2",
        "detailComment": "Unrecognised receipt",
        "taxCode": "OS",
        "taxRate": 0,
        "diya-gl:bankCode": "Q",
        "diya-gl:bankAccountID": "1200",
      },
    ]);
    await expect.poll(() => ruleState(page, id)).toBe("fail");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);
    await expect(bookCheck(page, id).locator("[data-helper-preview]")).toHaveCount(0);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("pass");
  });

  test("book-bank-line-has-side: a bank entry that is neither a receipt nor a payment", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-bank-line-has-side";
    const before = await ruleStates(page);

    await appendLines(page, [
      {
        "entryNumber": "BREAK-BANK-SIDE",
        "sourceJournalID": "bank",
        "postingDate": "2025-07-17",
        "accountMainID": "1200",
        "debitCreditCode": "X",
        "amount": 500,
        "documentType": "bank-statement",
        "documentReference": "BNK-BREAK-3",
        "detailComment": "Direction unknown",
        "taxCode": "OS",
        "taxRate": 0,
        "diya-gl:bankCode": "DR",
        "diya-gl:bankAccountID": "1200",
      },
    ]);
    await expect.poll(() => ruleState(page, id)).toBe("fail");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("pass");
  });

  test("book-cash-never-overdrawn: a cash payment larger than any cash the book ever held", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-cash-never-overdrawn";
    const before = await ruleStates(page);

    await appendLines(page, [
      {
        "entryNumber": "BREAK-CASH-OVERDRAWN",
        "sourceJournalID": "bank",
        "postingDate": "2025-04-20",
        "accountMainID": "1220",
        "debitCreditCode": "C",
        "amount": 1000000,
        "documentType": "bank-statement",
        "documentReference": "BNK-BREAK-4",
        "detailComment": "Cash paid out",
        "taxCode": "OS",
        "taxRate": 0,
        "diya-gl:bankCode": "CR",
        "diya-gl:bankAccountID": "1220",
      },
    ]);
    await expect.poll(() => ruleState(page, id)).toBe("warn");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("pass");
  });

  test("book-bank-overdrawn: a bank payment larger than the account's balance", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-bank-overdrawn";
    const before = await ruleStates(page);

    await appendLines(page, [
      {
        "entryNumber": "BREAK-BANK-OVERDRAWN",
        "sourceJournalID": "bank",
        "postingDate": "2025-04-20",
        "accountMainID": "1200",
        "debitCreditCode": "C",
        "amount": 1000000,
        "documentType": "bank-statement",
        "documentReference": "BNK-BREAK-5",
        "detailComment": "Bank paid out",
        "taxCode": "OS",
        "taxRate": 0,
        "diya-gl:bankCode": "CR",
        "diya-gl:bankAccountID": "1200",
      },
    ]);
    await expect.poll(() => ruleState(page, id)).toBe("warn");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("pass");
  });

  test("book-payslip-names-employee: a payslip for someone the book does not employ", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-payslip-names-employee";
    const before = await ruleStates(page);

    await appendLines(page, [
      {
        "entryNumber": "BREAK-PAYSLIP",
        "sourceJournalID": "payroll",
        "postingDate": "2025-07-28",
        "accountMainID": "5101",
        "amount": 1500,
        "documentType": "payslip",
        "documentReference": "PAY-BREAK-1",
        "detailComment": "Nobody Here",
        "diya-gl:grossPay": 1500,
      },
    ]);
    await expect.poll(() => ruleState(page, id)).toBe("fail");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);

    const check = bookCheck(page, id);
    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("Nobody Here");
    await check.locator("[data-helper-apply]").click();
    await expect.poll(() => ruleState(page, id)).toBe("pass");
    await allChecksPass(page);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("fail");
  });

  test("book-employee-paid-every-month: the labourer's June payslip removed", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-employee-paid-every-month";
    const before = await ruleStates(page);

    await removeLineByEntryNumber(page, "TXN-0047");
    await expect.poll(() => ruleState(page, id)).toBe("warn");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("pass");
  });

  test("book-fixed-asset-rows-fit: a sixth asset purchase, past the Schedule's five new-asset rows", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-fixed-asset-rows-fit";
    const before = await ruleStates(page);

    await appendLines(
      page,
      [
        ["2025-05-06", 1500, "Tool Hire Direct"],
        ["2025-06-09", 2400, "Site Plant Sales"],
        ["2025-08-11", 3100, "Cutting Gear Co"],
        ["2025-10-14", 1900, "Scaffold Systems"],
        ["2026-01-19", 2750, "Mixer Supplies"],
      ].map(([postingDate, amount, detailComment], index) => ({
        entryNumber: "BREAK-FA-" + (index + 1),
        sourceJournalID: "purchases",
        postingDate,
        accountMainID: "5900",
        amount,
        documentType: "invoice",
        documentReference: "PUR-BREAK-" + (index + 1),
        detailComment,
        taxCode: "NA",
        taxRate: 0,
      })),
    );
    await expect.poll(() => ruleState(page, id)).toBe("fail");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("pass");
  });

  test("book-vat-threshold: a sale that lifts turnover well past the registration threshold", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-vat-threshold";
    const before = await ruleStates(page);

    await appendLines(page, [
      {
        entryNumber: "BREAK-TURNOVER",
        sourceJournalID: "sales",
        postingDate: "2026-03-20",
        accountMainID: "4000",
        amount: 50000,
        documentType: "invoice",
        documentReference: "INV-BREAK-1",
        detailComment: "Riverside Homes",
        taxCode: "NA",
        taxRate: 0,
      },
    ]);
    await expect.poll(() => ruleState(page, id)).toBe("warn");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("pass");
  });

  test("book-dates-in-period: a sale after the year end fails, with no VAT period end to excuse it", async ({ page }) => {
    await openSeNonVat(page);
    const id = "book-dates-in-period";
    const before = await ruleStates(page);

    await appendLines(page, [
      {
        entryNumber: "BREAK-STRADDLE",
        sourceJournalID: "sales",
        postingDate: "2026-04-15",
        accountMainID: "4000",
        amount: 1000,
        documentType: "invoice",
        documentReference: "INV-BREAK-2",
        detailComment: "Meadow Court",
        taxCode: "NA",
        taxRate: 0,
      },
    ]);
    await expect.poll(() => ruleState(page, id)).toBe("fail");
    assertOnlyThisRuleFlips(before, await ruleStates(page), id);

    const check = bookCheck(page, id);
    await check.locator("[data-helper-preview]").click();
    await expect(check.locator(".helper-changes li")).toContainText("date 2026-04-15 → 2026-03-31");
    await check.locator("[data-helper-apply]").click();
    await expect.poll(() => ruleState(page, id)).toBe("pass");
    await allChecksPass(page);

    await undo(page);
    await expect.poll(() => ruleState(page, id)).toBe("fail");
  });
});

// ============================== E2: the four settlement helpers ==============================
// A fresh book carries no settlements at all, so one crafted half is the
// only suggestion of its kind on the card -- the settlement equivalent of
// the ten rule tests above, over T6's own four kinds.

async function settleTestBook(page, businessName) {
  await openNewSeBook(page, businessName);
  await appendLines(page, [
    {
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
    },
    {
      "entryNumber": "BREAK-SETTLE-PURCHASE",
      "sourceJournalID": "bank",
      "postingDate": "2025-07-21",
      "accountMainID": "1200",
      "debitCreditCode": "C",
      "amount": 320,
      "documentType": "bank-statement",
      "documentReference": "BNK-SETTLE-2",
      "detailComment": "Timber Merchants Ltd",
      "taxCode": "OS",
      "taxRate": 0,
      "diya-gl:bankCode": "CR",
      "diya-gl:bankAccountID": "1200",
    },
    {
      // Large enough that applying purchase-from-payment's own settlement
      // (a further £320 of expense) still leaves the book showing a profit --
      // a net loss on a book with no [expected] table trips a genuine,
      // unrelated reconciliation mismatch in se.js's checkCompliance (a
      // fresh single-purchase book alone reproduces the same four failures:
      // "SA103S: net profit ...", "Forecast: personal allowance after
      // taper", "SA103F box 65 ...", "Accounting profit to tax profit
      // bridge closes to zero"), which this settlement proof is not the
      // place to chase.
      entryNumber: "BREAK-SETTLE-RECEIPT",
      sourceJournalID: "sales",
      postingDate: "2025-07-22",
      accountMainID: "4000",
      amount: 900,
      documentType: "invoice",
      documentReference: "INV-SETTLE-1",
      detailComment: "Riverside Homes",
      taxCode: "OS",
      taxRate: 0,
    },
    {
      entryNumber: "BREAK-SETTLE-PAYMENT",
      sourceJournalID: "purchases",
      postingDate: "2025-07-23",
      accountMainID: "5000",
      amount: 275,
      documentType: "invoice",
      documentReference: "INV-SETTLE-2",
      detailComment: "Cement Supplies Ltd",
      taxCode: "OS",
      taxRate: 0,
    },
  ]);
  await openView(page, "bank");
}

async function lineCount(page) {
  return page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.lines.length);
}

test.describe("DIYA-GL Self Employed page — E2: each settlement helper's preview and result", () => {
  test("sale-from-receipt: a banked receipt with no sale behind it", async ({ page }) => {
    await settleTestBook(page, "Settlement Test Sale");
    const id = "sale-from-receipt:BREAK-SETTLE-SALE";

    await page.locator(`[data-settlement-preview="${id}"]`).click();
    await expect(page.locator(".helper-changes li")).toContainText("sale 4000 — Sales Product A — £480.00 on 2025-07-20");

    const before = await lineCount(page);
    await page.locator(`[data-settlement-apply="${id}"]`).click();
    await expect(page.locator("#toast")).toContainText("Added the missing half of " + id);
    await expect.poll(() => lineCount(page)).toBe(before + 1);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(0);
    await allChecksPass(page);

    await undo(page);
    await expect.poll(() => lineCount(page)).toBe(before);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(1);
  });

  test("purchase-from-payment: a bank payment with no purchase behind it", async ({ page }) => {
    await settleTestBook(page, "Settlement Test Purchase");
    const id = "purchase-from-payment:BREAK-SETTLE-PURCHASE";

    await page.locator(`[data-settlement-preview="${id}"]`).click();
    await expect(page.locator(".helper-changes li")).toContainText("purchase 5002 — Other Direct Cost of Sales — £320.00 on 2025-07-21");

    const before = await lineCount(page);
    await page.locator(`[data-settlement-apply="${id}"]`).click();
    await expect(page.locator("#toast")).toContainText("Added the missing half of " + id);
    await expect.poll(() => lineCount(page)).toBe(before + 1);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(0);
    await allChecksPass(page);

    await undo(page);
    await expect.poll(() => lineCount(page)).toBe(before);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(1);
  });

  test("receipt-for-sale: a sale that never reached the bank", async ({ page }) => {
    await settleTestBook(page, "Settlement Test Receipt");
    const id = "receipt-for-sale:BREAK-SETTLE-RECEIPT";

    await page.locator(`[data-settlement-preview="${id}"]`).click();
    await expect(page.locator(".helper-changes li")).toContainText("receipt 1200 — Current account — £900.00 on 2025-07-22");

    const before = await lineCount(page);
    await page.locator(`[data-settlement-apply="${id}"]`).click();
    await expect(page.locator("#toast")).toContainText("Added the missing half of " + id);
    await expect.poll(() => lineCount(page)).toBe(before + 1);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(0);
    await allChecksPass(page);

    await undo(page);
    await expect.poll(() => lineCount(page)).toBe(before);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(1);
  });

  test("payment-for-purchase: a purchase that never reached the bank", async ({ page }) => {
    await settleTestBook(page, "Settlement Test Payment");
    const id = "payment-for-purchase:BREAK-SETTLE-PAYMENT";

    await page.locator(`[data-settlement-preview="${id}"]`).click();
    await expect(page.locator(".helper-changes li")).toContainText("payment 1200 — Current account — £275.00 on 2025-07-23");

    const before = await lineCount(page);
    await page.locator(`[data-settlement-apply="${id}"]`).click();
    await expect(page.locator("#toast")).toContainText("Added the missing half of " + id);
    await expect.poll(() => lineCount(page)).toBe(before + 1);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(0);
    await allChecksPass(page);

    await undo(page);
    await expect.poll(() => lineCount(page)).toBe(before);
    await expect(page.locator(`[data-settlement-preview="${id}"]`)).toHaveCount(1);
  });
});

// ============================== E3: the uploaded nine-workbook package ==============================
// The book above arrives as diya-gl, already numbered. A package arrives as
// nine workbooks the page extracts itself, and the extractor numbers each
// journal apart, so a bank row and a payroll row can each be changed on its
// own rather than sharing a number and rendering as a figure.

const SE_PACKAGE_DIR = path.join(ROOT, "examples/se-latest");

async function sePackageZipBytes() {
  const zip = new JSZip();
  for (const name of fs.readdirSync(SE_PACKAGE_DIR).filter((file) => file.endsWith(".xlsx"))) {
    zip.file(name, fs.readFileSync(path.join(SE_PACKAGE_DIR, name)));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function uploadSePackage(page) {
  await page.setViewportSize(DESKTOP_LANDSCAPE);
  await page.goto(`${baseUrl}/books/se.html`, { waitUntil: "domcontentloaded" });
  await dropFile(page, await sePackageZipBytes(), "se-latest-package.zip");
  await expect(page.locator(".year-table-scroll")).toBeVisible({ timeout: 60_000 });
}

function amountsByEntryNumber(page) {
  return page.evaluate(() => Object.fromEntries(window.DIYA_BOOKS_SNAPSHOT.lines.map((line) => [line.entryNumber, line.amount])));
}

// The first month whose grid offers an editable amount in both journals.
async function monthOfferingBoth(page, journals) {
  const months = await page.locator(".year-row").count();
  for (let i = 0; i < months; i++) {
    const monthKey = await page.locator(".year-row").nth(i).getAttribute("data-month");
    await openMonthEntries(page, monthKey);
    const entries = {};
    for (const journal of journals) {
      await switchJournal(page, journal);
      const input = page.locator(`table.entries-table[data-journal="${journal}"] .entry-amount-input`).first();
      if (await input.count()) entries[journal] = await input.getAttribute("data-amount-entry");
    }
    if (journals.every((journal) => entries[journal])) return { monthKey, entries };
  }
  throw new Error(`no month offers an editable amount in all of ${journals.join(", ")}`);
}

async function editAmountBy(page, monthKey, journal, entryNumber, delta) {
  await openMonthEntries(page, monthKey);
  await switchJournal(page, journal);
  const field = page.locator(`table.entries-table[data-journal="${journal}"] [data-amount-entry="${entryNumber}"]`);
  const was = Number(await field.inputValue());
  await field.fill(String(was + delta));
  await field.press("Enter");
  await expect(page.locator("#toast")).toContainText("Changed " + entryNumber);
}

test.describe("DIYA-GL Self Employed page — E3: an uploaded package's lines are edited one at a time", () => {
  test("a payroll edit and a bank edit each land on their own line", async ({ page }) => {
    await uploadSePackage(page);

    const numbers = await page.evaluate(() => window.DIYA_BOOKS_SNAPSHOT.lines.map((line) => line.entryNumber));
    const counts = new Map();
    for (const number of numbers) counts.set(number, (counts.get(number) || 0) + 1);
    const shared = [...counts].filter(([, count]) => count > 1).map(([number]) => number);
    expect(shared, `entry numbers on more than one line: ${shared.join(", ")}`).toEqual([]);

    const before = await amountsByEntryNumber(page);
    const { monthKey, entries } = await monthOfferingBoth(page, ["bank", "payroll"]);
    expect(entries.bank).not.toBe(entries.payroll);

    await editAmountBy(page, monthKey, "bank", entries.bank, 250);
    await editAmountBy(page, monthKey, "payroll", entries.payroll, 100);

    const after = await amountsByEntryNumber(page);
    const moved = Object.keys(after).filter((entryNumber) => after[entryNumber] !== before[entryNumber]);
    expect(moved.sort()).toEqual([entries.bank, entries.payroll].sort());
    expect(after[entries.bank]).toBe(before[entries.bank] + 250);
    expect(after[entries.payroll]).toBe(before[entries.payroll] + 100);
  });
});
