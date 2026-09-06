// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-anchors.test.js -- the Limited Company anchor table and input-cell
// predicate (app/lib/anchors/ltd.js), proved against the shipped March and
// October packages and against the writer's own output: the table passes a
// real package at both year ends, names every workbook a customer's own
// upload could drop, names every header a customer's own upload could
// retype, the formula anchors catch a customer's own formula stripped out,
// and the predicate recognises every cell app/products/ltd.js's
// cellWrites() actually fills while rejecting every other formula cell the
// template ships except the documented prompt-formula exceptions.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";
import { workbookFormulaMap } from "../lib/template-formula-map.js";
import { workbookSetFromDirectory, workbookSetFromZipBytes } from "../lib/workbook-set.js";
import { AnchorError } from "../lib/anchors/run.js";
import { ltdAnchors, ltdYearEndMonth, validateLtdAnchors, isLtdInputCell } from "../lib/anchors/ltd.js";
import { monthTabOrder } from "../lib/ltd-layout.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { cellWrites } from "../products/ltd.js";
import {
  extractMultiFileTransactions,
  extractBankTransactions,
  extractPayrollTransactions,
  extractJournalEntries,
  bstExtractionMap,
} from "../lib/xlsx-exporter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const MARCH_PACKAGE_DIR = resolve(ROOT, "packages", "GB Accounts Company 2026-03-31 (Mar26) Excel 2007");
const OCTOBER_PACKAGE_DIR = resolve(ROOT, "packages", "GB Accounts Company 2026-10-31 (Oct26) Excel 2007");
const LTD_LATEST_DIR = resolve(ROOT, "examples", "ltd-latest");

const MARCH_TABLE = ltdAnchors(3);
const LTD_FILES = Object.keys(MARCH_TABLE);

const baseBytes = Object.fromEntries(LTD_FILES.map((file) => [file, readFileSync(resolve(MARCH_PACKAGE_DIR, file))]));

function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
  return zip.generateAsync({ type: "uint8array" });
}

async function setWithFileReplaced(file, patchedBytes) {
  const entries = { ...baseBytes, [file]: patchedBytes };
  return workbookSetFromZipBytes(await zipOf(entries));
}

// A copy of one package file with a header cell's text swapped for another,
// the shape a customer's own retyped label takes.
async function retypedFile(originalBytes, sheet, cellRef, newText) {
  const zip = await JSZip.loadAsync(originalBytes);
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheet);
  expect(sheetPath, `sheet "${sheet}" not found in the fixture`).toBeTruthy();
  const sheetXml = await zip.file(sheetPath).async("string");
  const sstXml = await zip.file("xl/sharedStrings.xml").async("string");
  const cellMatch = sheetXml.match(new RegExp(`<c r="${cellRef}"[^>]*t="s"[^>]*><v>(\\d+)</v></c>`));
  expect(cellMatch, `${sheet}!${cellRef} is not a shared-string cell in the fixture`).not.toBeNull();
  const uniqueMatch = sstXml.match(/uniqueCount="(\d+)"/);
  const countMatch = sstXml.match(/count="(\d+)"/);
  const newIndex = Number(uniqueMatch[1]);
  const patchedSst = sstXml
    .replace(/<\/sst>/, `<si><t>${newText}</t></si></sst>`)
    .replace(/count="(\d+)"/, `count="${Number(countMatch[1]) + 1}"`)
    .replace(/uniqueCount="(\d+)"/, `uniqueCount="${newIndex + 1}"`);
  const patchedSheet = sheetXml.replace(cellMatch[0], `<c r="${cellRef}" t="s"><v>${newIndex}</v></c>`);
  zip.file(sheetPath, patchedSheet);
  zip.file("xl/sharedStrings.xml", patchedSst);
  return zip.generateAsync({ type: "uint8array" });
}

// A copy of one package file with a plain numeric cell's value changed --
// the shape a customer's own retyped number takes (Payslips!Employee!D29
// carries a literal 1, not a shared string, so retypedFile()'s shared-string
// patch does not apply to it).
async function renumberedFile(originalBytes, sheet, cellRef, newValue) {
  const zip = await JSZip.loadAsync(originalBytes);
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheet);
  expect(sheetPath, `sheet "${sheet}" not found in the fixture`).toBeTruthy();
  const xml = await zip.file(sheetPath).async("string");
  const cellMatch = xml.match(new RegExp(`<c r="${cellRef}"(?![^>]*t=")[^>]*><v>[^<]*</v></c>`));
  expect(cellMatch, `${sheet}!${cellRef} is not a plain numeric cell in the fixture`).not.toBeNull();
  const patched = cellMatch[0].replace(/<v>[^<]*<\/v>/, `<v>${newValue}</v>`);
  zip.file(sheetPath, xml.replace(cellMatch[0], patched));
  return zip.generateAsync({ type: "uint8array" });
}

// A copy of one package file with a formula cell's <f> element dropped,
// leaving the cached value in place -- the shape a customer's own
// typed-over formula anchor takes.
async function withFormulaStripped(originalBytes, sheet, cellRef) {
  const zip = await JSZip.loadAsync(originalBytes);
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheet);
  expect(sheetPath, `sheet "${sheet}" not found in the fixture`).toBeTruthy();
  const xml = await zip.file(sheetPath).async("string");
  const element = xml.match(new RegExp(`<c r="${cellRef}"[^>]*(?:/>|>[\\s\\S]*?</c>)`))?.[0];
  expect(element, `${sheet}!${cellRef} has no <c> element in the fixture`).toBeTruthy();
  const stripped = element.replace(/<f[^>]*(?:\/>|>[\s\S]*?<\/f>)/, "");
  expect(stripped, `no <f> to strip from ${sheet}!${cellRef}`).not.toBe(element);
  zip.file(sheetPath, xml.replace(element, stripped));
  return zip.generateAsync({ type: "uint8array" });
}

describe("ltdAnchors against the shipped packages", () => {
  it("the March package passes every anchor", async () => {
    const set = await workbookSetFromDirectory(MARCH_PACKAGE_DIR);
    await expect(ltdYearEndMonth(set)).resolves.toBe(3);
    await expect(validateLtdAnchors(set)).resolves.toBeUndefined();
  });

  it("the October package passes every anchor, tabs in Nov..Oct order", async () => {
    const set = await workbookSetFromDirectory(OCTOBER_PACKAGE_DIR);
    await expect(ltdYearEndMonth(set)).resolves.toBe(10);
    expect(ltdAnchors(10)["Sales.xlsx"].sheets.slice(1, 13)).toEqual(monthTabOrder(10));
    await expect(validateLtdAnchors(set)).resolves.toBeUndefined();
  });

  it("examples/ltd-latest -- the same October year end -- passes every anchor", async () => {
    const set = await workbookSetFromDirectory(LTD_LATEST_DIR);
    await expect(ltdYearEndMonth(set)).resolves.toBe(10);
    await expect(validateLtdAnchors(set)).resolves.toBeUndefined();
  });

  it.each(LTD_FILES)("a package missing %s is refused naming the file", async (missing) => {
    const entries = Object.fromEntries(LTD_FILES.filter((file) => file !== missing).map((file) => [file, baseBytes[file]]));
    const set = await workbookSetFromZipBytes(await zipOf(entries));

    let caught;
    try {
      await validateLtdAnchors(set);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AnchorError);
    expect(caught.findings).toEqual([{ file: null, sheet: null, cell: null, message: `file "${missing}" not found in the package` }]);
  });

  // Payslips!Employee!D29 carries a literal 1, not a shared string --
  // proved breakable separately below, by renumbering rather than retyping.
  const allHeaders = LTD_FILES.flatMap((file) => MARCH_TABLE[file].headers.map((header) => ({ file, ...header }))).filter(
    (header) => !(header.file === "Payslips.xlsx" && header.sheet === "Employee" && header.cell === "D29"),
  );
  it.each(allHeaders)("$file sheet $sheet cell $cell retyped is refused naming file, sheet and cell", async ({ file, sheet, cell }) => {
    const patched = await retypedFile(baseBytes[file], sheet, cell, "x");
    const set = await setWithFileReplaced(file, patched);

    let caught;
    try {
      await validateLtdAnchors(set);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AnchorError);
    expect(caught.findings.length).toBe(1);
    expect(caught.findings[0]).toMatchObject({ file, sheet, cell });
  });

  it("'Payslips.xlsx' sheet 'Employee' cell 'D29' renumbered is refused naming file, sheet and cell", async () => {
    const patched = await renumberedFile(baseBytes["Payslips.xlsx"], "Employee", "D29", 2);
    const set = await setWithFileReplaced("Payslips.xlsx", patched);

    let caught;
    try {
      await validateLtdAnchors(set);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AnchorError);
    expect(caught.findings.length).toBe(1);
    expect(caught.findings[0]).toMatchObject({ file: "Payslips.xlsx", sheet: "Employee", cell: "D29" });
  });

  // The formula anchors (OpenAccounts!E37, Schedule!E1/E57/E110,
  // FAreconciliation!E13, HPfinance!E2, RegisterofMembers!F1/G1,
  // VATQtr1!K2, Vatinterface!B4) are not header labels -- their cached value
  // is package-specific -- so this proves the other half of the guard: a
  // customer's own formula stripped from one of them is reported by file,
  // sheet and cell, the same as a retyped header.
  it("a formula anchor with its formula stripped is refused naming file, sheet and cell", async () => {
    const patched = await withFormulaStripped(baseBytes["Financialaccounts.xlsx"], "OpenAccounts", "E37");
    const set = await setWithFileReplaced("Financialaccounts.xlsx", patched);

    let caught;
    try {
      await validateLtdAnchors(set);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AnchorError);
    expect(caught.findings).toEqual([
      {
        file: "Financialaccounts.xlsx",
        sheet: "OpenAccounts",
        cell: "E37",
        message: 'sheet "OpenAccounts" cell E37: expected a formula, found none',
      },
    ]);
  });
});

describe("isLtdInputCell against the writer's own output", () => {
  function writesFor(yearEndMonth) {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"), "-P1Y");
    const scenario = diyaGlToScenario(book, lines, "ltd");
    return cellWrites(scenario, 2024, yearEndMonth);
  }

  it.each([3, 10])("every cell the writer fills at a %i year end is an input cell", (yearEndMonth) => {
    const writes = writesFor(yearEndMonth);
    const monthTabs = monthTabOrder(yearEndMonth);

    let total = 0;
    for (const [file, sheets] of Object.entries(writes)) {
      for (const [sheet, cells] of Object.entries(sheets)) {
        for (const cellRef of Object.keys(cells)) {
          total++;
          expect(isLtdInputCell(file, sheet, cellRef, monthTabs), `${file}!${sheet}!${cellRef}`).toBe(true);
        }
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it.each([
    ["Financialaccounts.xlsx", "MnthP&L", "B9"], // turnover, SUM(B4:B8)
    ["Sales.xlsx", "Apr", "H1"], // the month's own net-of-VAT total, SUM(H5:H300)
    ["Purchases.xlsx", "Apr", "H1"], // the month's own net-of-VAT total
    ["Currentaccount.xlsx", "May", "A1"], // the roll-forward formula, =Apr!A2, not the first tab
    ["Fixedassets.xlsx", "Schedule", "E11"], // the land class's own existingTotalRow, not an existingRows row
    ["Companysecretary.xlsx", "RegisterofMembers", "F1"], // =F3, row 1 is not a REGISTER_MEMBER_ROWS row
    ["Vatreturns.xlsx", "VATQtr1", "K2"], // =Vatinterface!B6
    ["Salesinvoice.xlsx", "Invoice Template", "P58"], // the printed invoice's own net total
  ])("%s!%s!%s is a computed cell the writer never touches, not an input cell", (file, sheet, cell) => {
    expect(isLtdInputCell(file, sheet, cell)).toBe(false);
  });

  // Every formula cell the March template ships, cross-checked against the
  // predicate: any it accepts as an input cell must be one of the writer's
  // own documented prompt-formula overwrites (a "Enter Letter"/"Enter Code"
  // column, a ledger's own balance echo, the first Sales tab's VAT-rate
  // default, the Payslips monthly block's own per-row defaults, or the
  // Stock sheet's own physical-count formula) -- never anything else. Proved
  // against both year ends, since the exception set is the same set of
  // columns whichever month starts the book's tabs.
  const KNOWN_PROMPT_FORMULA_KEYS = new Set([
    "Sales.xlsx!month!E",
    "Sales.xlsx!month!G",
    "Sales.xlsx!OpeningDebtors!H",
    "Sales.xlsx!ClosingDebtors!H",
    "Purchases.xlsx!month!E",
    "Purchases.xlsx!OpeningCreditors!H",
    "Purchases.xlsx!ClosingCreditors!H",
    "Currentaccount.xlsx!month!E",
    "Currentaccount.xlsx!month!W",
    "Savingaccount.xlsx!month!E",
    "Savingaccount.xlsx!month!W",
    "Creditcardaccount.xlsx!month!E",
    "Creditcardaccount.xlsx!month!W",
    "Cashaccount.xlsx!month!E",
    "Cashaccount.xlsx!month!T",
    "Payslips.xlsx!month!F",
    "Payslips.xlsx!month!M",
    "Payslips.xlsx!month!R",
    "Financialaccounts.xlsx!Stock!AB",
  ]);

  it.each([
    [MARCH_PACKAGE_DIR, 3],
    [OCTOBER_PACKAGE_DIR, 10],
  ])("no formula cell of the %s template is an input cell outside the documented exceptions", async (dir, yearEndMonth) => {
    const set = await workbookSetFromDirectory(dir);
    const monthTabs = monthTabOrder(yearEndMonth);
    const foundKeys = new Set();

    for (const file of set.names()) {
      const zip = await set.zip(file);
      const bySheet = await workbookFormulaMap(zip);
      for (const [sheet, cells] of bySheet) {
        for (const [cellRef] of cells) {
          if (!isLtdInputCell(file, sheet, cellRef, monthTabs)) continue;
          const col = cellRef.match(/^[A-Z]+/)[0];
          const sheetCategory = monthTabs.includes(sheet) ? "month" : sheet;
          const key = `${file}!${sheetCategory}!${col}`;
          expect(KNOWN_PROMPT_FORMULA_KEYS.has(key), `${file}!${sheet}!${cellRef} (${key})`).toBe(true);
          foundKeys.add(key);
        }
      }
    }
    expect(foundKeys).toEqual(KNOWN_PROMPT_FORMULA_KEYS);
  });
});

describe("the four multi-file extractors over examples/ltd-latest", () => {
  // examples/ltd-latest is the October year end (Nov..Oct tabs); its own
  // accounting period, read the same way ltd-workbook.test.js and
  // ltd-link-caches.test.js read a package's period.
  const PERIOD = { start: "2025-11-01", end: "2026-10-31" };

  it("record 725 lines between them, keyed file!sheet!cell and unique", async () => {
    const set = await workbookSetFromDirectory(LTD_LATEST_DIR);
    const extractionMap = bstExtractionMap("ltd");

    const journal = await extractMultiFileTransactions(set, "ltd", extractionMap);
    const bank = await extractBankTransactions(set, "ltd", PERIOD, extractionMap);
    const payroll = await extractPayrollTransactions(set, extractionMap);
    const stock = await extractJournalEntries(set, "ltd", PERIOD, extractionMap);

    expect(journal.length + bank.length + payroll.length + stock.length).toBe(725);
    // 724 of the 725: every line but the stock movement's own "cost of
    // sales" leg, whose only input cell is already the "Opening stock"
    // line's own address (see xlsx-exporter.test.js's recordLine coverage).
    expect(extractionMap.lines().length).toBe(724);

    const keys = [];
    for (const record of extractionMap.lines()) {
      for (const cellRef of Object.values(record.cells)) keys.push(`${record.file}!${record.sheet}!${cellRef}`);
    }
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);

    // A real posted line resolves back through lineForCell under its own
    // file -- the wiring the sidecar and the report appendix both depend on.
    const salesLine = extractionMap.lineForCell("Sales.xlsx", "Nov", "A5");
    expect(salesLine).toMatchObject({ file: "Sales.xlsx", sheet: "Nov" });
  });
});
