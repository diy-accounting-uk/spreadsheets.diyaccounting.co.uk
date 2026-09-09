// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// A Self Employed package keeps two calendars.
//
// The Admin sheet's period ends, the VAT interface's period rows and each
// return form's own period end follow the tax year the package is generated
// for. Every transaction now follows it too: se.js's cellWrites shifts each
// tx.date by the whole years between the book's own period and the
// package's, the way ltd.js's cellWrites shifts a Company's, so a package
// generated for a later year carries its accounts and its bank statements
// under the one period rather than two.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { generateSpreadsheet, applyYearEndSequence } from "../lib/generator.js";
import { applyCellWrites } from "../lib/spreadsheet-runner.js";
import { readXlsxCellValues } from "../lib/xlsx-reader.js";
import { dateFromExcelSerial } from "../lib/calculators/shared.js";
import { cellWrites } from "../products/se.js";
import { payslipsWagesPaidCell } from "../lib/payslips-layout.js";
import { VATINTERFACE_FIRST_ROW, VATINTERFACE_FIRST_MONTH_ROW, VATINTERFACE_LAST_ROW } from "../lib/tax/vat.js";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");
const BOOK_DIR = path.join(ROOT, "examples/precision-code-ltd/advanced");

// The master book covers 2025-26.
const OWN_YEAR = "se-2025-2026";
const LATER_YEAR = "se-2026-2027";
const DAYS_BETWEEN = 365;
const OWN_START_YEAR = 2025;

const MONEY_BOXES = ["G9", "G11", "G13", "G15", "G17", "G21", "G23"];
const PERIOD_COLUMNS = ["D", "F", "H", "J"];

function scenarioFor(offset) {
  const { book, lines } = loadDiyaGlData(BOOK_DIR, offset);
  return { book, lines, scenario: diyaGlToScenario(book, lines, "se") };
}

function resultsFor({ book, lines, scenario }, years) {
  const taxData = parseTOML(fs.readFileSync(path.join(ROOT, "app/data", `${years}.toml`), "utf-8"));
  return calculateFromDiyaGl(book, lines, "se", taxData, scenario);
}

// Every entry date the writer puts on a journal tab. Row 1 and 2 carry the
// tab's own totals, so a date row starts at 3.
function entryDates(writes) {
  const dates = {};
  for (const [file, sheets] of Object.entries(writes)) {
    for (const [sheet, cells] of Object.entries(sheets)) {
      for (const [cell, value] of Object.entries(cells)) {
        const row = /^A(\d+)$/.exec(cell);
        if (row && Number(row[1]) >= 3) dates[`${file}!${sheet}!${cell}`] = value;
      }
    }
  }
  return dates;
}

// The tax data a target year's package carries. Every committed year but the
// two years past the master book's own has its own TOML on disk; a target
// further out than that reuses the latest committed rates under the target
// year's own label and dates, the way a scenario's shape rather than its
// rates is what this file tests.
function taxDataFor(targetStartYear) {
  const committed = path.join(APP_DIR, "data", `se-${targetStartYear}-${targetStartYear + 1}.toml`);
  if (fs.existsSync(committed)) return parseTOML(fs.readFileSync(committed, "utf8"));
  const taxData = parseTOML(fs.readFileSync(path.join(APP_DIR, "data/se-2026-2027.toml"), "utf8"));
  taxData.tax_year = {
    ...taxData.tax_year,
    label: `${targetStartYear}-${String(targetStartYear + 1).slice(-2)}`,
    next_label: `${targetStartYear + 1}-${String(targetStartYear + 2).slice(-2)}`,
    start: new Date(Date.UTC(targetStartYear, 3, 6)),
    end: new Date(Date.UTC(targetStartYear + 1, 3, 5)),
  };
  return taxData;
}

// The three files a target year's package composes, the way generate.js
// composes them: the year's rates, the year-end sequence, and the
// scenario's own cells. No link-cache refresh -- every cell this file reads
// is one the generator or the writer put there directly, not one a
// cross-file formula computes.
async function filesFor(book, lines, targetStartYear) {
  const productMeta = parseTOML(fs.readFileSync(path.join(APP_DIR, "templates/se/meta.toml"), "utf8"));
  const scenario = diyaGlToScenario(book, lines, "se");
  const taxData = taxDataFor(targetStartYear);
  const endDate = new Date(taxData.tax_year.end);
  const writes = cellWrites(scenario, targetStartYear);

  const files = {};
  for (const templateFile of ["Financialaccounts.xlsx", "Sales.xlsx", "Payslips.xlsx"]) {
    const fileKey = templateFile.replace(".xlsx", "").toLowerCase();
    const sheetsConfig = productMeta.sheets[fileKey];
    let buffer = fs.readFileSync(path.join(APP_DIR, "templates/se", templateFile));
    if (sheetsConfig) buffer = await generateSpreadsheet(buffer, taxData, sheetsConfig);
    buffer = await applyYearEndSequence(buffer, templateFile, sheetsConfig, 0, endDate, taxData.tax_year);
    if (writes[templateFile]) buffer = await applyCellWrites(buffer, writes[templateFile]);
    files[templateFile] = buffer;
  }
  return files;
}

describe("the Self Employed package's two calendars", () => {
  const master = scenarioFor();

  it("leaves the book's own year alone", () => {
    const dates = entryDates(cellWrites(master.scenario, OWN_START_YEAR));
    expect(Object.keys(dates).length).toBeGreaterThan(500);
    // Sales.xlsx!Apr!A5 is the first entry of the master book's own first
    // month, anchored on the fixture's own earliest sale (TXN-0016).
    expect(dateFromExcelSerial(dates["Sales.xlsx!Apr!A5"]).toISOString().slice(0, 10)).toBe("2025-04-01");
  });

  it("shifts every entry onto the year the package is generated for", () => {
    const own = entryDates(cellWrites(master.scenario, OWN_START_YEAR));
    const later = entryDates(cellWrites(master.scenario, OWN_START_YEAR + 1));
    expect(Object.keys(later)).toEqual(Object.keys(own));
    for (const cell of Object.keys(own)) {
      const ownDate = dateFromExcelSerial(own[cell]);
      const laterDate = dateFromExcelSerial(later[cell]);
      expect(laterDate.getUTCFullYear(), cell).toBe(ownDate.getUTCFullYear() + 1);
      expect(laterDate.getUTCMonth(), cell).toBe(ownDate.getUTCMonth());
      expect(laterDate.getUTCDate(), cell).toBe(ownDate.getUTCDate());
    }
  });

  it("reproduces the same dates whichever vintage of the book generated them, once both name the same target year", () => {
    // A book already exported from a package one year on carries dates one
    // year ahead of the master's own, and declares a period one year ahead
    // too -- so writing both into the same target year cancels the gap, the
    // way generating from an export reproduces the same cells (see
    // ltd-period-shift.test.js).
    const fromMaster = entryDates(cellWrites(master.scenario, OWN_START_YEAR + 1));
    const fromExported = entryDates(cellWrites(scenarioFor("+P1Y").scenario, OWN_START_YEAR + 1));
    expect(fromExported).toEqual(fromMaster);
  });

  it("moves the VAT calendar a whole year on when the package is", () => {
    const own = resultsFor(master, OWN_YEAR);
    const later = resultsFor(master, LATER_YEAR);
    for (let row = VATINTERFACE_FIRST_ROW; row <= VATINTERFACE_LAST_ROW; row++) {
      expect(later["Vat.xlsx!Vatinterface"][`B${row}`] - own["Vat.xlsx!Vatinterface"][`B${row}`]).toBe(DAYS_BETWEEN);
    }
    for (let form = 1; form <= 5; form++) {
      expect(later[`Vat.xlsx!VATQtr${form}`].G5 - own[`Vat.xlsx!VATQtr${form}`].G5).toBe(DAYS_BETWEEN);
    }
  });

  it("puts the same VAT figures on both years' returns, so the gap frames nothing", () => {
    const own = resultsFor(master, OWN_YEAR);
    const later = resultsFor(master, LATER_YEAR);
    for (let row = VATINTERFACE_FIRST_MONTH_ROW; row <= VATINTERFACE_LAST_ROW; row++) {
      for (const column of PERIOD_COLUMNS) {
        expect(later["Vat.xlsx!Vatinterface"][`${column}${row}`]).toBe(own["Vat.xlsx!Vatinterface"][`${column}${row}`]);
      }
    }
    for (let form = 1; form <= 5; form++) {
      for (const box of MONEY_BOXES) {
        expect(later[`Vat.xlsx!VATQtr${form}`][box]).toBe(own[`Vat.xlsx!VATQtr${form}`][box]);
      }
    }
  });

  it("agrees Admin's period, the first Sales posting and the Payslips dates on one period, two years past the book's own", async () => {
    const targetStartYear = OWN_START_YEAR + 2;
    const files = await filesFor(master.book, master.lines, targetStartYear);

    const admin = (await readXlsxCellValues(files["Financialaccounts.xlsx"], { Admin: ["B4", "B17"] })).Admin;
    const periodStart = dateFromExcelSerial(admin.B4);
    const periodEnd = dateFromExcelSerial(admin.B17);
    expect(periodStart.toISOString().slice(0, 10)).toBe(`${targetStartYear}-04-06`);
    expect(periodEnd.toISOString().slice(0, 10)).toBe(`${targetStartYear + 1}-04-05`);

    // The master book's own period runs calendar-month to calendar-month
    // (1 April to 31 March), five days either side of the Admin sheet's
    // strict 6 April to 5 April tax year -- so agreement here means the
    // shifted date names the same April the Admin period opens in, not
    // that it falls inside the tax year's own five-day-narrower window.
    const firstSale = (await readXlsxCellValues(files["Sales.xlsx"], { Apr: ["A5"] })).Apr.A5;
    const saleDate = dateFromExcelSerial(firstSale);
    expect(saleDate.getUTCFullYear(), `first sale ${saleDate.toISOString()}`).toBe(periodStart.getUTCFullYear());
    expect(saleDate.toISOString().slice(0, 10)).toBe(`${targetStartYear}-04-01`);

    const wagesPaidCell = payslipsWagesPaidCell(0); // April, the first payroll month
    const wagesPaid = (await readXlsxCellValues(files["Payslips.xlsx"], { Apr: [wagesPaidCell] })).Apr[wagesPaidCell];
    const wagesPaidDate = dateFromExcelSerial(wagesPaid);
    expect(wagesPaidDate.getUTCFullYear(), `wages paid ${wagesPaidDate.toISOString()}`).toBe(periodStart.getUTCFullYear());
    expect(wagesPaidDate.toISOString().slice(0, 10)).toBe(`${targetStartYear}-04-30`);
  });

  it("writes the master's own year exactly as it did before the shift existed", async () => {
    const files = await filesFor(master.book, master.lines, OWN_START_YEAR);
    const firstSale = (await readXlsxCellValues(files["Sales.xlsx"], { Apr: ["A5"] })).Apr.A5;
    expect(dateFromExcelSerial(firstSale).toISOString().slice(0, 10)).toBe("2025-04-01");

    const wagesPaidCell = payslipsWagesPaidCell(0);
    const wagesPaid = (await readXlsxCellValues(files["Payslips.xlsx"], { Apr: [wagesPaidCell] })).Apr[wagesPaidCell];
    expect(dateFromExcelSerial(wagesPaid).toISOString().slice(0, 10)).toBe("2025-04-30");
  });
});
