// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// A Company package states its accounting period four times over: the Admin
// year-end seed and the date chain under it, the two financial-year rows the
// corporation tax computation and the CT600 read, the twelve month tabs, and
// the date on every posting the writer puts on them. A package generated for
// a year end the scenario's own book does not cover has to move the postings
// onto its period, or the accounts are drawn up for one year and the bank
// statements sit in another.
//
// No LibreOffice: the year-end sequence and the cell writes are both plain
// Node, and every figure asserted here is one of the two.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";

import { generateSpreadsheet, applyYearEndSequence } from "../lib/generator.js";
import { applyCellWrites } from "../lib/spreadsheet-runner.js";
import { readXlsxCellValues } from "../lib/xlsx-reader.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { cellWrites } from "../products/ltd.js";
import { taxYearFileName } from "../lib/tax-year.js";
import { BANK_ACCOUNT_FILES, BANK_LAYOUTS, monthTabOrder } from "../lib/ltd-layout.js";
import { dateFromExcelSerial } from "../lib/calculators/shared.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");
const HUB = "Financialaccounts.xlsx";
const CURRENT_ACCOUNT = BANK_ACCOUNT_FILES["1200"];
const MASTER_BOOK = "examples/precision-code-ltd/full";

// The year end examples/ltd-latest is generated for, seven months on from the
// master book's own March period and a year past it.
const OCTOBER = "2027-10-31";

function master() {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, MASTER_BOOK));
  return { book, lines, scenario: diyaGlToScenario(book, lines, "ltd") };
}

// The hub of the package generate.js builds for one year end: the year's
// rates, the year-end sequence that rolls every cached date and financial
// year onto it, and the scenario's own cells.
async function generatedHub(scenario, yearEnd) {
  const endDate = new Date(`${yearEnd}T00:00:00Z`);
  const productMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates/ltd/meta.toml"), "utf8"));
  const taxData = parseTOML(readFileSync(resolve(APP_DIR, `data/${taxYearFileName(endDate, "ltd")}.toml`), "utf8"));
  taxData.financial_year.end = yearEnd;
  const sheetsConfig = productMeta.sheets.financialaccounts;
  const yearEndMonth = endDate.getUTCMonth() + 1;

  const writes = cellWrites(scenario, endDate.getUTCFullYear() - 1, yearEndMonth);
  let buffer = readFileSync(resolve(APP_DIR, "templates/ltd", HUB));
  buffer = await generateSpreadsheet(buffer, taxData, sheetsConfig);
  buffer = await applyYearEndSequence(buffer, HUB, sheetsConfig, yearEndMonth, endDate, taxData.financial_year);
  buffer = await applyCellWrites(buffer, writes[HUB]);

  const cells = await readXlsxCellValues(buffer, {
    Admin: ["B9", "B32", "K6", "K7"],
    CorporationTax: ["E33", "E34"],
    CT600: ["C126"],
  });
  return { writes, admin: cells.Admin, corporationTax: cells.CorporationTax, ct600: cells.CT600, yearEndMonth };
}

// The UK financial year a date falls in: the calendar year of the 1 April on
// or before it, which is how the Admin rows and the CT600 boxes label one.
function financialYearOf(date) {
  return date.getUTCFullYear() - (date.getUTCMonth() + 1 < 4 ? 1 : 0);
}

// Every posting date the writer puts on a bank, sales or purchases tab, as
// dates. The bank books take their date column from the layout; the sales and
// purchases journals both write column A.
function postedDates(writes) {
  const dates = [];
  for (const [file, sheets] of Object.entries(writes)) {
    const layout = BANK_LAYOUTS[file];
    for (const [sheet, cells] of Object.entries(sheets)) {
      for (const [cell, value] of Object.entries(cells)) {
        const column = cell.replace(/\d+$/, "");
        // A1 is never a date: a journal sums its own column there and a bank
        // tab takes the account's opening balance in it.
        if (cell === "A1") continue;
        const isJournalDate = (file === "Sales.xlsx" || file === "Purchases.xlsx") && column === "A";
        const isBankDate = layout && (column === layout.receipt.date || column === layout.payment.date);
        if (isJournalDate || isBankDate) dates.push({ where: `${file}!${sheet}!${cell}`, date: dateFromExcelSerial(value) });
      }
    }
  }
  return dates;
}

describe("a Company package generated for a year end the book does not cover", () => {
  it("dates the first bank line inside the period the Admin sheet declares", async () => {
    const { writes, admin } = await generatedHub(master().scenario, OCTOBER);

    const periodStart = dateFromExcelSerial(admin.B9);
    const periodEnd = dateFromExcelSerial(admin.B32);
    expect(periodEnd.toISOString().slice(0, 10)).toBe(OCTOBER);
    expect(periodStart.toISOString().slice(0, 10)).toBe("2026-11-01");

    const firstTab = monthTabOrder(10)[0];
    const layout = BANK_LAYOUTS[CURRENT_ACCOUNT];
    const firstLine = writes[CURRENT_ACCOUNT][firstTab][`${layout.payment.date}6`];
    expect(dateFromExcelSerial(firstLine).toISOString().slice(0, 10)).toBe("2026-11-01");
  });

  it("keeps every posting inside that period", async () => {
    const { writes, admin } = await generatedHub(master().scenario, OCTOBER);
    const periodStart = dateFromExcelSerial(admin.B9);
    const periodEnd = dateFromExcelSerial(admin.B32);

    const dates = postedDates(writes);
    expect(dates.length).toBeGreaterThan(400);
    const outside = dates.filter(({ date }) => date < periodStart || date > periodEnd);
    expect(outside.map((entry) => `${entry.where} ${entry.date.toISOString().slice(0, 10)}`)).toEqual([]);
  });

  it("posts into the two financial years the CT600 names", async () => {
    const { writes, admin, corporationTax, ct600 } = await generatedHub(master().scenario, OCTOBER);

    // Box 330 caches the working sheet's first tax row and box 380 the
    // second (CT600!C128 = CorporationTax!E34), which are the Admin sheet's
    // own two financial years.
    expect([ct600.C126, corporationTax.E33, corporationTax.E34]).toEqual([admin.K6, admin.K6, admin.K7]);
    expect([admin.K6, admin.K7]).toEqual([2026, 2027]);

    const years = [...new Set(postedDates(writes).map(({ date }) => financialYearOf(date)))].sort();
    expect(years).toEqual([admin.K6, admin.K7]);
  });

  // The catalogue's other eleven year ends move the tabs as well as the year;
  // a December year end is the one whose period opens in the same calendar
  // year its accounts are made up to.
  it.each([
    ["2027-01-31", "2026-02-01"],
    ["2026-03-31", "2025-04-01"],
    ["2027-04-30", "2026-05-01"],
    ["2027-12-31", "2027-01-01"],
    ["2020-10-31", "2019-11-01"],
  ])("opens the period on %s at %s and posts nothing outside it", async (yearEnd, periodStartIso) => {
    const { writes, admin } = await generatedHub(master().scenario, yearEnd);
    const periodStart = dateFromExcelSerial(admin.B9);
    const periodEnd = dateFromExcelSerial(admin.B32);
    expect(periodStart.toISOString().slice(0, 10)).toBe(periodStartIso);
    expect(periodEnd.toISOString().slice(0, 10)).toBe(yearEnd);

    const outside = postedDates(writes).filter(({ date }) => date < periodStart || date > periodEnd);
    expect(outside.map((entry) => `${entry.where} ${entry.date.toISOString().slice(0, 10)}`)).toEqual([]);
  });

  // A book exported from a package of the same year end is written back where
  // it stands: the gap between its own period and the package's is nil.
  it("leaves a book already in the package's period alone", () => {
    const { scenario } = master();
    const asIs = cellWrites(scenario, 2025, 3);
    const firstSale = asIs["Sales.xlsx"].Apr.A5;
    expect(dateFromExcelSerial(firstSale).toISOString().slice(0, 10)).toBe("2025-04-01");
  });
});
