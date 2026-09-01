// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// The Payslips Admin calendar seeds B2 with 6 April and lays out a fixed 53
// weeks below it. I1 names the day the calendar runs to; it must be 5 April
// of the next year whether or not the year spans a leap February, so it is
// derived from B2 rather than read from a fixed row.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { parse as parseTOML } from "smol-toml";
import { runMultiFileSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet, getMonthTabSequence, reorientPayslipsMonthTabPeriods } from "../lib/generator.js";
import { monthlyPayrollBlockRow, payrollYearStart, payslipsPeriodStartCell, payslipsWagesPaidCell } from "../lib/payslips-layout.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";
import {
  cellWrites as ltdCellWrites,
  standardReads as ltdReads,
  multiFileOptions as ltdOptions,
  checkCompliance as ltdCheckCompliance,
} from "../products/ltd.js";

const ROOT = resolve(import.meta.dirname, "../..");
const APP_DIR = resolve(ROOT, "app");
const DATA_DIR = resolve(APP_DIR, "data");
// The year the tax year a package was built for opens in, which is the payroll
// year the Employee sheet's start dates are read against.
const seTaxYearStart = (taxData) => new Date(taxData.tax_year.start).getUTCFullYear();
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describe.each(["se", "ltd"])("%s Payslips Admin calendar year end", (product) => {
  it("I1 derives 5 April of the next year from the B2 seed", async () => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(ROOT, `app/templates/${product}/Payslips.xlsx`)));
    const xml = await zip.file("xl/worksheets/sheet16.xml").async("string");
    const cell = xml.match(/<c r="I1"[^>]*><f>([^<]*)<\/f>/);
    expect(cell).not.toBeNull();
    expect(cell[1]).toBe("DATE(YEAR(B2)+1,MONTH(B2),DAY(B2))-1");
  });
});

// The printed payslip pulls every figure off the month tab H3 names, at the
// row H4 works out. Spelling that reference as H3 & "!C" & H4 assumes the "!"
// sheet separator of Excel's own grammar: LibreOffice reads a name built that
// way as #REF! and prints a page of errors. ADDRESS emits whichever separator
// the engine reading the file uses, so the same formula resolves in both.
describe.each(["se", "ltd"])("%s Payslips print sheet period join", (product) => {
  it("names the month tab through ADDRESS rather than a hard-coded sheet separator", async () => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(ROOT, `app/templates/${product}/Payslips.xlsx`)));
    const xml = await zip.file("xl/worksheets/sheet14.xml").async("string");
    const formulas = [...xml.matchAll(/<f[^>]*>([^<]*INDIRECT[^<]*)<\/f>/g)].map((m) => m[1]);
    expect(formulas).toHaveLength(104);
    for (const formula of formulas) {
      expect(formula).toMatch(/INDIRECT\(ADDRESS\([^)]*,\$H\$3\)\)/);
      expect(formula).not.toContain('&amp; "!');
    }
  });
});

// A March year end names its tabs the way the template already does, so the
// reorientation has nothing to move and must hand the workbook back byte for
// byte -- every March package's Payslips.xlsx is what it always was.
describe("ltd Payslips month-tab periods at the template's own year end", () => {
  it("hands a March package's workbook back untouched", async () => {
    const buffer = readFileSync(resolve(ROOT, "app/templates/ltd/Payslips.xlsx"));
    const reoriented = await reorientPayslipsMonthTabPeriods(buffer, new Date(Date.UTC(2026, 2, 31)), payrollYearStart(2025));
    expect(reoriented).toBe(buffer);
  });
});

// Payslips.xlsx Jul (sheet5.xml) and Aug (sheet6.xml) shipped with 35 dead
// #REF! cells -- Jul!F11:F15 and Jul!T41 (5 cells and 1 style mismatch),
// Aug!H11:M15 with K on rows 12-15 (29 cells) -- invisible on every
// recalculated package because nothing read either tab directly and the
// guard condition each broken formula sits behind (a weekly pay frequency,
// or a carried-over weekly cycle) is never true for any fixture. This
// proves the fix at the template level (no #REF! left anywhere in a
// generated, recalculated package) and that the new checks reading these
// tabs directly are real: each one fails on its own when the cell it reads
// is corrupted, and nothing else moves.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

// Overwrites a cell's cached <v> content in place, leaving any <f> formula
// tag untouched -- the way a stale or corrupted cached value would reach a
// reader that only ever sees the last-saved cell.
function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v[^>]*>)([^<]*)(</v>)`, "s");
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

// Scans every sheet of a recalculated package file for a literal "#REF!",
// naming the sheets that hold one.
async function findRefErrors(savedDir, fileName) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, fileName)));
  const sheetMap = await buildSheetMap(zip);
  const found = [];
  for (const [sheetName, path] of sheetMap) {
    const content = await zip.file(path).async("string");
    if (content.includes("#REF!")) found.push(sheetName);
  }
  return found;
}

describeCalc("se Payslips Jul/Aug: the dead #REF! cells and the fixture's own payroll data", () => {
  const SE_DIR = resolve(APP_DIR, "templates", "se");
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

    savedDir = mkdtempSync(join(tmpdir(), "se-payslips-jul-aug-"));
    results = await runMultiFileSpreadsheet(
      fileBuffers,
      seCellWrites(scenario, seTaxYearStart(taxData)),
      seReads(),
      "Financialaccounts.xlsx",
      {
        ...seOptions(),
        saveRecalculatedTo: savedDir,
      },
    );
    checks = seCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 300000);

  afterAll(() => {
    if (savedDir) rmSync(savedDir, { recursive: true, force: true });
  });

  it("leaves no #REF! anywhere in the recalculated Payslips.xlsx", async () => {
    expect(await findRefErrors(savedDir, "Payslips.xlsx")).toEqual([]);
  });

  it("reads Jul and Aug at all -- a prerequisite every check below depends on", () => {
    expect(results["Payslips.xlsx!Jul"]).toBeDefined();
    expect(results["Payslips.xlsx!Aug"]).toBeDefined();
  });

  // The Payslips sheet is the page an employer prints and hands over. It
  // joins itself to a month tab through H3 (the tab's name) and H4 (the row
  // its block starts on), and every printed field is an INDIRECT through
  // that pair. Nothing downstream reads the page, so a join landing on the
  // wrong period would print one month's pay under another month's heading
  // with every other check on the book still green.
  it("the printed payslip joins to the month tab and block for the period it was asked for", () => {
    const printed = results["Payslips.xlsx!Payslips"];
    expect(printed.H3).toBe("May");
    expect(printed.L7).toBe("MONTHLY PAYROLL");
    expect(printed.I10).toBe(2);
    expect(printed.H4).toBe(48);
  });

  it("passes every printed-payslip check on the intact book", () => {
    const printChecks = checks.filter((c) => c.name.startsWith("Payslips print:") && c.severity !== "warning");
    expect(printChecks).toHaveLength(14);
    for (const c of printChecks) {
      expect(c.pass, `${c.name}: expected ${c.expected}, actual ${c.actual}`).toBe(true);
    }
  });

  it.each([
    ["H3", "Apr", "Payslips print: the page reads the May tab"],
    ["L7", "WEEKLY PAYROLL", "Payslips print: the block the page reads is a monthly payroll"],
    ["I10", 1, "Payslips print: the period printed is payroll month 2"],
    ["I9", 40000, "Payslips print: the period ends the day the scenario paid that month's wages"],
    ["M8", 2, "Payslips print: the page's join to the employee's line carries their payroll number"],
    ["G14", 1, "Payslips print: gross pay is the pay the scenario recorded"],
    ["H14", 1, "Payslips print: income tax is the tax the scenario recorded"],
    ["I14", 1, "Payslips print: national insurance is the employee NI the scenario recorded"],
    ["M14", 1, "Payslips print: net pay is the net pay the scenario recorded"],
    ["G16", 1, "Payslips print: gross pay to date is every month printed so far"],
    ["H16", 1, "Payslips print: income tax to date is every month printed so far"],
    ["I16", 1, "Payslips print: national insurance to date is every month printed so far"],
    ["M16", 1, "Payslips print: net pay to date is every month printed so far"],
    ["M18", 1, "Payslips print: the payment date reads a cell the block leaves empty"],
  ])("corrupting Payslips.xlsx!Payslips!%s fails only its own printed-payslip check", async (cellRef, newValue, name) => {
    expect(checks.find((c) => c.name === name)?.pass).toBe(true);

    const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Payslips", cellRef, newValue);
    expect(failureNames(checksWithCorruptedCell("Payslips.xlsx!Payslips", cellRef, value))).toEqual([name]);
  });

  it("passes every Payslips Jul/Aug check on the intact book", () => {
    const payslipsChecks = checks.filter((c) => c.name.startsWith("Payslips!Jul") || c.name.startsWith("Payslips!Aug"));
    expect(payslipsChecks.length).toBeGreaterThan(0);
    for (const c of payslipsChecks) {
      expect(c.pass, `${c.name}: expected ${c.expected}, actual ${c.actual}`).toBe(true);
    }
  });

  it("July and August carry different payroll references for the same employees -- the fixture this coverage depends on", () => {
    const jul = results["Payslips.xlsx!Jul"];
    const aug = results["Payslips.xlsx!Aug"];
    expect(jul.S51).not.toBe(aug.S51);
    expect(jul.M51).toBe(aug.M51); // gross pay repeats -- the totals alone cannot tell the months apart
  });

  it("corrupting Payslips.xlsx!Jul!F12 via JSZip fails only the July employee-line check", async () => {
    const name = "Payslips!Jul F12 weekly employee line (every employee here pays monthly)";
    expect(checks.find((c) => c.name === name)?.pass).toBe(true);

    const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Jul", "F12", "Zzz");
    expect(value).toBe("Zzz");
    expect(failureNames(checksWithCorruptedCell("Payslips.xlsx!Jul", "F12", value))).toEqual([name]);
  });

  it("corrupting Payslips.xlsx!Aug!H13 via JSZip fails only the August brought-forward check", async () => {
    const name = "Payslips!Aug H13 brought forward from Jul (no weekly cycle carried over)";
    expect(checks.find((c) => c.name === name)?.pass).toBe(true);

    const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Aug", "H13", 999);
    expect(value).toBe(999);
    expect(failureNames(checksWithCorruptedCell("Payslips.xlsx!Aug", "H13", value))).toEqual([name]);
  });
});

describeCalc("ltd Payslips Jul/Aug: the dead #REF! cells and the fixture's own payroll data", () => {
  const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
  const YEAR_END_MONTH = 3; // March -- the template's own tab names, so "Jul"/"Aug" mean calendar Jul/Aug
  let results;
  let checks;
  let taxData;
  let expected;
  let savedDir;

  function checksWithCorruptedCell(resultKey, cellRef, value) {
    const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
    return ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
  }

  beforeAll(async () => {
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));

    const fileBuffers = {};
    for (const templateFile of productMeta.template.files) {
      const templateBuffer = readFileSync(resolve(LTD_DIR, templateFile));
      const fileKey = templateFile.replace(".xlsx", "").replace(".docx", "").toLowerCase();
      const sheetsConfig = productMeta.sheets?.[fileKey];
      fileBuffers[templateFile] =
        sheetsConfig && Object.keys(sheetsConfig).length > 0
          ? await generateSpreadsheet(templateBuffer, taxData, sheetsConfig)
          : templateBuffer;
    }

    const scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-scenario-full.toml"));
    expected = { ...scenario, ...scenario.expected };

    savedDir = mkdtempSync(join(tmpdir(), "ltd-payslips-jul-aug-"));
    results = await runMultiFileSpreadsheet(
      fileBuffers,
      ltdCellWrites(scenario, 2025, YEAR_END_MONTH),
      ltdReads(),
      "Financialaccounts.xlsx",
      { ...ltdOptions(YEAR_END_MONTH), saveRecalculatedTo: savedDir },
    );
    checks = ltdCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 900000);

  afterAll(() => {
    if (savedDir) rmSync(savedDir, { recursive: true, force: true });
  });

  it("leaves no #REF! anywhere in the recalculated Payslips.xlsx", async () => {
    expect(await findRefErrors(savedDir, "Payslips.xlsx")).toEqual([]);
  });

  it("reads Jul and Aug at all -- a prerequisite every check below depends on", () => {
    expect(results["Payslips.xlsx!Jul"]).toBeDefined();
    expect(results["Payslips.xlsx!Aug"]).toBeDefined();
  });

  // The Payslips sheet is the page an employer prints and hands over. It
  // joins itself to a month tab through H3 (the tab's name) and H4 (the row
  // its block starts on), and every printed field is an INDIRECT through
  // that pair. Nothing downstream reads the page, so a join landing on the
  // wrong period would print one month's pay under another month's heading
  // with every other check on the book still green.
  it("the printed payslip joins to the month tab and block for the period it was asked for", () => {
    const printed = results["Payslips.xlsx!Payslips"];
    expect(printed.H3).toBe("May");
    expect(printed.L7).toBe("MONTHLY PAYROLL");
    expect(printed.I10).toBe(2);
    expect(printed.H4).toBe(48);
  });

  it("passes every printed-payslip check on the intact book", () => {
    const printChecks = checks.filter((c) => c.name.startsWith("Payslips print:") && c.severity !== "warning");
    expect(printChecks).toHaveLength(14);
    for (const c of printChecks) {
      expect(c.pass, `${c.name}: expected ${c.expected}, actual ${c.actual}`).toBe(true);
    }
  });

  it.each([
    ["H3", "Apr", "Payslips print: the page reads the May tab"],
    ["L7", "WEEKLY PAYROLL", "Payslips print: the block the page reads is a monthly payroll"],
    ["I10", 1, "Payslips print: the period printed is payroll month 2"],
    ["I9", 40000, "Payslips print: the period ends the day the scenario paid that month's wages"],
    ["M8", 2, "Payslips print: the page's join to the employee's line carries their payroll number"],
    ["G14", 1, "Payslips print: gross pay is the pay the scenario recorded"],
    ["H14", 1, "Payslips print: income tax is the tax the scenario recorded"],
    ["I14", 1, "Payslips print: national insurance is the employee NI the scenario recorded"],
    ["M14", 1, "Payslips print: net pay is the net pay the scenario recorded"],
    ["G16", 1, "Payslips print: gross pay to date is every month printed so far"],
    ["H16", 1, "Payslips print: income tax to date is every month printed so far"],
    ["I16", 1, "Payslips print: national insurance to date is every month printed so far"],
    ["M16", 1, "Payslips print: net pay to date is every month printed so far"],
    ["M18", 1, "Payslips print: the payment date reads a cell the block leaves empty"],
  ])("corrupting Payslips.xlsx!Payslips!%s fails only its own printed-payslip check", async (cellRef, newValue, name) => {
    expect(checks.find((c) => c.name === name)?.pass).toBe(true);

    const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Payslips", cellRef, newValue);
    expect(failureNames(checksWithCorruptedCell("Payslips.xlsx!Payslips", cellRef, value))).toEqual([name]);
  });

  it("passes every Payslips Jul/Aug check on the intact book", () => {
    const payslipsChecks = checks.filter((c) => c.name.startsWith("Payslips!Jul") || c.name.startsWith("Payslips!Aug"));
    expect(payslipsChecks.length).toBeGreaterThan(0);
    for (const c of payslipsChecks) {
      expect(c.pass, `${c.name}: expected ${c.expected}, actual ${c.actual}`).toBe(true);
    }
  });

  it("corrupting Payslips.xlsx!Jul!F12 via JSZip fails only the July employee-line check", async () => {
    const name = "Payslips!Jul F12 weekly employee line (every employee here pays monthly)";
    expect(checks.find((c) => c.name === name)?.pass).toBe(true);

    const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Jul", "F12", "Zzz");
    expect(value).toBe("Zzz");
    expect(failureNames(checksWithCorruptedCell("Payslips.xlsx!Jul", "F12", value))).toEqual([name]);
  });

  it("corrupting Payslips.xlsx!Aug!H13 via JSZip fails only the August brought-forward check", async () => {
    const name = "Payslips!Aug H13 brought forward (no weekly cycle carried over)";
    expect(checks.find((c) => c.name === name)?.pass).toBe(true);

    const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Aug", "H13", 999);
    expect(value).toBe(999);
    expect(failureNames(checksWithCorruptedCell("Payslips.xlsx!Aug", "H13", value))).toEqual([name]);
  });

  // A March year end runs its accounts over the same twelve months as its
  // payroll, so the template's own dates already name each tab's month and
  // the first block opens with the payroll year on 6 April rather than on
  // the 1st.
  it("keeps the template's own opening dates, the payroll year's first day included", () => {
    const periodChecks = checks.filter((c) => c.name.includes("the monthly payroll opens in the"));
    expect(periodChecks).toHaveLength(12);
    for (const c of periodChecks) {
      expect(c.pass, `${c.name}: expected ${c.expected}, actual ${c.actual}`).toBe(true);
    }
    expect(results["Payslips.xlsx!Apr"][payslipsPeriodStartCell(0)]).toBe(45753); // 6 April 2025
    expect(results["Payslips.xlsx!May"][payslipsPeriodStartCell(1)]).toBe(45778); // 1 May 2025
  });
});

// A June year end names its month tabs Jul through Jun, and everything on the
// Payslips workbook follows that order: each tab carries its place in the
// package's own year, its block starts on the row that place gives it, and
// the writers fill it by that place. The Admin sheet's "Month Sheet" column
// is the printed page's join from a period number to a tab name, and it is
// built from the payroll calendar's own April start -- the template's tab
// order, not this package's. Left alone it hands month 2 to the tab named
// May, which a June package still has, eleven months along. The page then
// prints May's figures under May's own period number, with every printed
// field agreeing with the tab it landed on and no other check on the book
// moving. Only a package whose tabs are not the template's can catch this.
describeCalc("ltd Payslips print page at a June year end", () => {
  const YEAR_END = "2026-06-30";
  const YEAR_END_MONTH = 6;
  const PRINTED_TAB = "Aug";
  const TABS = getMonthTabSequence(YEAR_END_MONTH);
  // The row payroll month 2 opens on, which is where the Admin sheet names
  // the tab the printed page joins to.
  const MONTH_2_CALENDAR_ROW = 28;

  // The accounting period this package covers, which its tab names run
  // through: 1 July 2025 to 30 June 2026.
  const PERIOD_MONTHS = TABS.map((tab, i) => ({
    tab,
    year: i < 6 ? 2025 : 2026,
    month: ((6 + i) % 12) + 1,
  }));

  let results;
  let checks;
  let taxData;
  let expected;
  let savedDir;
  let packageDir;
  let generatedDir;

  function checksWithCorruptedCell(resultKey, cellRef, value) {
    const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
    return ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
  }

  beforeAll(async () => {
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2026.toml"), "utf8"));

    packageDir = mkdtempSync(join(tmpdir(), "ltd-payslips-june-pkg-"));
    execFileSync(
      process.execPath,
      [
        "app/bin/generate.js",
        "--package",
        "ltd",
        "--years",
        "ltd-2026",
        "--year-end",
        YEAR_END,
        "--output-dir",
        packageDir,
        "--skip-guide",
      ],
      { cwd: ROOT, encoding: "utf8", timeout: 900000 },
    );
    const [generated] = readdirSync(packageDir);
    generatedDir = resolve(packageDir, generated);

    const fileBuffers = {};
    for (const file of readdirSync(generatedDir).filter((f) => f.endsWith(".xlsx"))) {
      fileBuffers[file] = readFileSync(resolve(generatedDir, file));
    }

    const scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-scenario-full.toml"));
    expected = { ...scenario, ...scenario.expected };

    savedDir = mkdtempSync(join(tmpdir(), "ltd-payslips-june-"));
    results = await runMultiFileSpreadsheet(
      fileBuffers,
      ltdCellWrites(scenario, 2025, YEAR_END_MONTH),
      ltdReads(),
      "Financialaccounts.xlsx",
      { ...ltdOptions(YEAR_END_MONTH), saveRecalculatedTo: savedDir },
    );
    checks = ltdCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 1800000);

  afterAll(() => {
    if (savedDir) rmSync(savedDir, { recursive: true, force: true });
    if (packageDir) rmSync(packageDir, { recursive: true, force: true });
  });

  it("ships the package's own month tabs, not the template's", async () => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, "Payslips.xlsx")));
    const names = [...(await buildSheetMap(zip)).keys()];
    expect(names.filter((name) => TABS.includes(name))).toEqual(TABS);
  });

  it("names every payroll month for the tab it belongs to", () => {
    const calendar = results["Payslips.xlsx!Admin"];
    expect(calendar[`A${MONTH_2_CALENDAR_ROW}`]).toBe(PRINTED_TAB);
    const nameChecks = checks.filter((c) => c.name.includes("names the") && c.name.startsWith("Payslips calendar:"));
    expect(nameChecks).toHaveLength(12);
    for (const c of nameChecks) {
      expect(c.pass, `${c.name}: expected ${c.expected}, actual ${c.actual}`).toBe(true);
    }
  });

  it("joins the printed page to the tab and block for the period it was asked for", () => {
    const printed = results["Payslips.xlsx!Payslips"];
    expect(printed.H3).toBe(PRINTED_TAB);
    expect(printed.L7).toBe("MONTHLY PAYROLL");
    expect(printed.I10).toBe(2);
    expect(printed.H4).toBe(48);
  });

  it("passes every printed-payslip check on the intact book", () => {
    const printChecks = checks.filter((c) => c.name.startsWith("Payslips print:") && c.severity !== "warning");
    expect(printChecks).toHaveLength(14);
    for (const c of printChecks) {
      expect(c.pass, `${c.name}: expected ${c.expected}, actual ${c.actual}`).toBe(true);
    }
  });

  // "May" and 11 are the pair the page printed before the Admin sheet named
  // this package's tabs: the tab eleven months along, under its own number.
  it.each([
    ["H3", "May", "Payslips print: the page reads the Aug tab"],
    ["I10", 11, "Payslips print: the period printed is payroll month 2"],
  ])("corrupting Payslips.xlsx!Payslips!%s fails only its own printed-payslip check", async (cellRef, newValue, name) => {
    expect(checks.find((c) => c.name === name)?.pass).toBe(true);

    const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Payslips", cellRef, newValue);
    expect(failureNames(checksWithCorruptedCell("Payslips.xlsx!Payslips", cellRef, value))).toEqual([name]);
  });

  it("corrupting the month-sheet name the page joins through fails only that name's check", async () => {
    const name = `Payslips calendar: payroll month 2 names the ${PRINTED_TAB} tab`;
    expect(checks.find((c) => c.name === name)?.pass).toBe(true);

    const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Admin", `A${MONTH_2_CALENDAR_ROW}`, "May");
    expect(value).toBe("May");
    expect(failureNames(checksWithCorruptedCell("Payslips.xlsx!Admin", `A${MONTH_2_CALENDAR_ROW}`, value))).toEqual([name]);
  });

  // The blank workbook, straight out of the generator and before any book is
  // written into it. This is what a customer downloads, and every date on it
  // is a date they read: the tab named Aug used to open its monthly payroll
  // on 1 May, the payroll calendar's second month under the accounting
  // period's second month's name.
  it("dates each blank month tab's monthly payroll block by the month its tab names", async () => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(generatedDir, "Payslips.xlsx")));
    const sheetMap = await buildSheetMap(zip);
    for (const [monthIndex, { tab, year, month }] of PERIOD_MONTHS.entries()) {
      const xml = await zip.file(sheetMap.get(tab)).async("string");
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const formulaOf = (cellRef) => (xml.match(new RegExp(`<c r="${cellRef}"[^>]*><f>([^<]*)</f>`)) || [])[1];
      expect(formulaOf(payslipsPeriodStartCell(monthIndex)), `${tab} opens`).toBe(`DATE(${year},${month},1)`);
      expect(formulaOf(payslipsWagesPaidCell(monthIndex)), `${tab} closes`).toBe(`DATE(${year},${month},${lastDay})`);
    }
  });

  it("passes every month-tab period check on the intact book", () => {
    const periodChecks = checks.filter((c) => c.name.includes("the monthly payroll opens in the"));
    expect(periodChecks).toHaveLength(12);
    for (const c of periodChecks) {
      expect(c.pass, `${c.name}: expected ${c.expected}, actual ${c.actual}`).toBe(true);
    }
  });

  // 1 May 2026 is the day the block on this tab opened on before the tabs and
  // the calendar were brought into one frame -- the payroll calendar's second
  // month, which the tab named Aug still carried.
  it("corrupting the day a month tab's payroll opens fails only that tab's period check", async () => {
    const monthIndex = 1;
    const cell = payslipsPeriodStartCell(monthIndex);
    const name = `Payslips!${PRINTED_TAB} ${cell} the monthly payroll opens in the ${PRINTED_TAB} of this period`;
    expect(checks.find((c) => c.name === name)?.pass).toBe(true);
    expect(monthlyPayrollBlockRow(monthIndex)).toBe(48);

    const value = await readCorruptedCell(savedDir, "Payslips.xlsx", PRINTED_TAB, cell, 46143);
    expect(value).toBe(46143);
    expect(failureNames(checksWithCorruptedCell(`Payslips.xlsx!${PRINTED_TAB}`, cell, value))).toEqual([name]);
  });
});
