// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Proves the Payslips calendar echo checks catch a broken workbook.
// Payslips.xlsx's own Admin sheet carries a day-by-day payroll calendar the
// generator writes for the package's tax year: it seeds B2 with the tax year
// start and fills the week and month columns, then every later date cascades
// from B2 and every month name is that many months on from B2's own month.
// Nothing read the calendar back, so a package could ship a payroll year
// starting on the wrong date -- dating every payslip in it to another year --
// with no check failing.
//
// Each check runs against a real LibreOffice-recalculated multi-file package,
// then again after corrupting one calendar cell's cached value in a copy of
// Payslips.xlsx via JSZip. Every corruption names the exact set of checks it
// is expected to flip.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { runMultiFileSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

// Overwrites a cell's cached <v> content in place, leaving any <f> formula
// tag untouched -- the way a stale or corrupted cached value would reach a
// reader that only ever sees the last-saved cell.
function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
}

// Loads a recalculated package file via JSZip, overwrites one cell's cached
// value, round-trips the archive and reads the cell back -- a real mutation
// of a copy of the workbook, not a string edit on the in-memory results.
async function readCorruptedCell(savedDir, fileName, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, fileName)));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readCorruptedCell: sheet ${sheetName} not found in ${fileName}`);
  const xml = await zip.file(sheetPath).async("string");
  zip.file(sheetPath, corruptCellValue(xml, cellRef, newValue));

  const corruptedBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const reloadedZip = await JSZip.loadAsync(corruptedBuffer);
  const sharedStrings = await loadSharedStrings(reloadedZip);
  const reloadedXml = await reloadedZip.file(sheetPath).async("string");
  return readCellValue(reloadedXml, cellRef, sharedStrings);
}

function failureNames(checks) {
  return checks.filter((c) => !c.pass && c.severity !== "warning").map((c) => c.name);
}

// Each corruption and the exact set of checks it must flip. A and D are the
// month name and the payroll month number, B the date; corrupting either of
// the two the name is built from breaks the name check.
const PAYROLL_CALENDAR_CORRUPTIONS = [
  [
    "B2",
    45760,
    [
      "Payslips calendar: the payroll year starts on the accounts tax year start (B2 = Admin B4)",
      "Payslips calendar row 2: the date runs on unbroken from the tax year start",
    ],
  ],
  ["I1", 46124, ["Payslips calendar: the year the calendar runs to (I1) = the accounts tax year end (Admin B17)"]],
  ["N1", "Zzz", ["Payslips calendar: the tax year the payslips print (N1) = the tax year the package was generated for"]],
  ["A2", "Zzz", ["Payslips calendar row 2: the month name is its payroll month counted from the tax year start"]],
  ["D2", 8, ["Payslips calendar row 2: the month name is its payroll month counted from the tax year start"]],
  ["A33", "Zzz", ["Payslips calendar row 33: the month name is its payroll month counted from the tax year start"]],
  ["B33", 45791, ["Payslips calendar row 33: the date runs on unbroken from the tax year start"]],
  ["D33", 9, ["Payslips calendar row 33: the month name is its payroll month counted from the tax year start"]],
  ["A64", "Zzz", ["Payslips calendar row 64: the month name is its payroll month counted from the tax year start"]],
  ["B64", 45822, ["Payslips calendar row 64: the date runs on unbroken from the tax year start"]],
  ["D64", 10, ["Payslips calendar row 64: the month name is its payroll month counted from the tax year start"]],
  ["A95", "Zzz", ["Payslips calendar row 95: the month name is its payroll month counted from the tax year start"]],
  ["B95", 45853, ["Payslips calendar row 95: the date runs on unbroken from the tax year start"]],
  ["D95", 11, ["Payslips calendar row 95: the month name is its payroll month counted from the tax year start"]],
  ["A126", "Zzz", ["Payslips calendar row 126: the month name is its payroll month counted from the tax year start"]],
  ["B126", 45884, ["Payslips calendar row 126: the date runs on unbroken from the tax year start"]],
  ["D126", 12, ["Payslips calendar row 126: the month name is its payroll month counted from the tax year start"]],
  ["A157", "Zzz", ["Payslips calendar row 157: the month name is its payroll month counted from the tax year start"]],
  ["B157", 45915, ["Payslips calendar row 157: the date runs on unbroken from the tax year start"]],
  ["D157", 13, ["Payslips calendar row 157: the month name is its payroll month counted from the tax year start"]],
  ["A188", "Zzz", ["Payslips calendar row 188: the month name is its payroll month counted from the tax year start"]],
  ["B188", 45946, ["Payslips calendar row 188: the date runs on unbroken from the tax year start"]],
  ["D188", 14, ["Payslips calendar row 188: the month name is its payroll month counted from the tax year start"]],
  ["A219", "Zzz", ["Payslips calendar row 219: the month name is its payroll month counted from the tax year start"]],
  ["B219", 45977, ["Payslips calendar row 219: the date runs on unbroken from the tax year start"]],
  ["D219", 15, ["Payslips calendar row 219: the month name is its payroll month counted from the tax year start"]],
  ["A250", "Zzz", ["Payslips calendar row 250: the month name is its payroll month counted from the tax year start"]],
  ["B250", 46008, ["Payslips calendar row 250: the date runs on unbroken from the tax year start"]],
  ["D250", 16, ["Payslips calendar row 250: the month name is its payroll month counted from the tax year start"]],
  ["A281", "Zzz", ["Payslips calendar row 281: the month name is its payroll month counted from the tax year start"]],
  ["B281", 46039, ["Payslips calendar row 281: the date runs on unbroken from the tax year start"]],
  ["D281", 17, ["Payslips calendar row 281: the month name is its payroll month counted from the tax year start"]],
  ["A312", "Zzz", ["Payslips calendar row 312: the month name is its payroll month counted from the tax year start"]],
  ["B312", 46070, ["Payslips calendar row 312: the date runs on unbroken from the tax year start"]],
  ["D312", 18, ["Payslips calendar row 312: the month name is its payroll month counted from the tax year start"]],
  ["A343", "Zzz", ["Payslips calendar row 343: the month name is its payroll month counted from the tax year start"]],
  ["B343", 46101, ["Payslips calendar row 343: the date runs on unbroken from the tax year start"]],
  ["D343", 19, ["Payslips calendar row 343: the month name is its payroll month counted from the tax year start"]],
  ["A366", "Zzz", ["Payslips calendar row 366: the month name is its payroll month counted from the tax year start"]],
  ["B366", 46124, ["Payslips calendar row 366: the date runs on unbroken from the tax year start"]],
  ["D366", 19, ["Payslips calendar row 366: the month name is its payroll month counted from the tax year start"]],
  ["A381", "Zzz", ["Payslips calendar row 381: the month name is its payroll month counted from the tax year start"]],
  ["B381", 46139, ["Payslips calendar row 381: the date runs on unbroken from the tax year start"]],
  ["D381", 19, ["Payslips calendar row 381: the month name is its payroll month counted from the tax year start"]],
];

describeCalc("Payslips calendar echo catches a broken payroll year", () => {
  let results;
  let checks;
  let taxData;
  let expected;
  let savedDir;

  function checksWithCorruptedCell(resultKey, cellRef, value) {
    const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
    return seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
  }

  beforeAll(async () => {
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));

    const fileBuffers = {};
    for (const templateFile of productMeta.template.files) {
      const templateBuffer = readFileSync(resolve(SE_DIR, templateFile));
      const fileKey = templateFile.replace(".xlsx", "").toLowerCase();
      const sheetsConfig = productMeta.sheets?.[fileKey];
      fileBuffers[templateFile] =
        sheetsConfig && Object.keys(sheetsConfig).length > 0
          ? await generateSpreadsheet(templateBuffer, taxData, sheetsConfig)
          : templateBuffer;
    }

    const scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml"));
    expected = { ...scenario, ...scenario.expected };

    savedDir = mkdtempSync(join(tmpdir(), "se-payroll-calendar-checks-"));
    results = await runMultiFileSpreadsheet(fileBuffers, seCellWrites(scenario), seReads(), "Financialaccounts.xlsx", {
      ...seOptions(),
      saveRecalculatedTo: savedDir,
    });
    checks = seCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 300000);

  afterAll(() => {
    if (savedDir) rmSync(savedDir, { recursive: true, force: true });
  });

  it("reads the payroll calendar at all -- a prerequisite every check below depends on", () => {
    const calendar = results["Payslips.xlsx!Admin"];
    expect(calendar).toBeDefined();
    expect(calendar.B2).toBeGreaterThan(0);
    expect(calendar.I1).toBeGreaterThan(calendar.B2);
  });

  it("starts the payroll year on the accounts tax year start and runs it to the accounts tax year end", () => {
    const calendar = results["Payslips.xlsx!Admin"];
    expect(calendar.B2).toBe(results.Admin.B4);
    expect(calendar.I1).toBe(results.Admin.B17);
    // 6 April to 5 April is 365 days, so the year-to date is 364 rows on
    // from the seed. The two anchors above would both hold on a calendar
    // that had lost days in the middle; this says the cascade is unbroken.
    expect(calendar.B366 - calendar.B2).toBe(364);
  });

  it("names all twelve payroll months, in the order the tax year runs", () => {
    const calendar = results["Payslips.xlsx!Admin"];
    const names = [2, 33, 64, 95, 126, 157, 188, 219, 250, 281, 312, 343].map((row) => calendar[`A${row}`]);
    expect(names).toEqual(["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]);
  });

  it("passes every payroll calendar check on the intact book", () => {
    const calendarChecks = checks.filter((c) => c.name.startsWith("Payslips calendar"));
    expect(calendarChecks.length).toBeGreaterThan(0);
    for (const check of calendarChecks) {
      expect(check.pass, `${check.name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }
  });

  it("covers every payroll calendar check with at least one corruption", () => {
    const asserted = new Set(PAYROLL_CALENDAR_CORRUPTIONS.flatMap(([, , failures]) => failures));
    const missing = checks.filter((c) => c.name.startsWith("Payslips calendar") && !asserted.has(c.name)).map((c) => c.name);
    expect(missing).toEqual([]);
  });

  it.each(PAYROLL_CALENDAR_CORRUPTIONS)(
    "corrupting Payslips.xlsx!Admin!%s via JSZip fails exactly the checks that read it",
    async (cellRef, corruptedValue, expectedFailures) => {
      for (const name of expectedFailures) {
        expect(checks.find((c) => c.name === name)?.pass, `${name} was already failing`).toBe(true);
      }

      const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Admin", cellRef, corruptedValue);
      expect(value).toBe(corruptedValue);
      expect(failureNames(checksWithCorruptedCell("Payslips.xlsx!Admin", cellRef, value))).toEqual(expectedFailures);
    },
  );
});
