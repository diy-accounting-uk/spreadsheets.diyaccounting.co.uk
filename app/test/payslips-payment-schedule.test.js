// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// Two things about the Payslips workbook a customer sees before any book is
// entered: the dates on the month tabs' payroll blocks, and which tab each row
// of the PAYE remittance schedule adds up.
//
// The blocks chain off the Admin calendar rather than reading it, so rolling
// the calendar alone left every counted date on the template's own year -- a
// week ending a year before it started. The schedule's rows are tax months and
// its month-tab references were moved by the tab rename, so the row headed 30
// April went on to sum whichever tab had taken first place in the package's
// accounting year.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { parse as parseTOML } from "smol-toml";
import {
  buildSheetMap,
  hasLibreOffice,
  getLibreOffice,
  loadSharedStrings,
  readCellValue,
  xslRoundtrip,
  runMultiFileSpreadsheet,
} from "../lib/spreadsheet-runner.js";
import {
  generateSpreadsheet,
  getMonthTabSequence,
  realignPayslipsPaymentSchedule,
  renameExternalLinkSheetNames,
  renameMonthTabs,
  reorientPayslipsAdminMonthSheets,
  reorientPayslipsMonthTabPeriods,
} from "../lib/generator.js";
import {
  PAYE_DUE_DATE_DAYS,
  PAYE_MONTH_END_DAYS,
  PAYE_SCHEDULE_FIRST_ROW,
  PAYE_SCHEDULE_MONTH_TABS,
  PAYROLL_WEEKS_PER_MONTH,
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_SHEET,
  payrollYearStart,
} from "../lib/payslips-layout.js";
import { payslipsChainedDateCells } from "../lib/payslips-date-chain.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";

const ROOT = resolve(import.meta.dirname, "../..");
const APP_DIR = resolve(ROOT, "app");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const PAYSLIPS_ADMIN_SHEET_PATH = "xl/worksheets/sheet16.xml";

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;
const serial = (date) => Math.round((date.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY);
const dateOf = (value) => new Date(EXCEL_EPOCH_UTC + value * MS_PER_DAY);
// Monday 1 through Sunday 7, the return type the template's WEEKDAY asks for.
const isoWeekday = (date) => ((date.getUTCDay() + 6) % 7) + 1;

// The blank Payslips.xlsx a customer downloads, built the way generate.js
// builds it: the tax data written in, then -- for a year end other than the
// template's March -- the tabs renamed, the calendar's month-sheet column and
// the tabs' own periods reoriented, and the PAYE schedule repointed.
async function blankPayslips({ product, taxData: taxDataFile, yearEnd, yearEndMonth }) {
  const taxData = parseTOML(readFileSync(resolve(DATA_DIR, taxDataFile), "utf8"));
  const period = taxData.tax_year || taxData.financial_year;
  const productMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates", product, "meta.toml"), "utf8"));
  const payrollYearOpens = payrollYearStart(new Date(period.start).getUTCFullYear());

  let buffer = await generateSpreadsheet(
    readFileSync(resolve(APP_DIR, "templates", product, "Payslips.xlsx")),
    taxData,
    productMeta.sheets.payslips,
  );
  // Only the Ltd package reorients: a Self Employed year always ends on
  // 5 April, so its tabs are the template's own.
  if (yearEndMonth) {
    buffer = await renameMonthTabs(buffer, yearEndMonth);
    buffer = await renameExternalLinkSheetNames(buffer, yearEndMonth);
    buffer = await reorientPayslipsAdminMonthSheets(buffer, yearEndMonth, PAYSLIPS_ADMIN_SHEET_PATH);
    buffer = await reorientPayslipsMonthTabPeriods(buffer, yearEnd, payrollYearOpens);
    buffer = await realignPayslipsPaymentSchedule(buffer, yearEndMonth);
  }
  return { buffer, payrollYearOpens };
}

// Every sheet's cells, keyed "Sheet!Ref", with the formula text and the cached
// value each one carries.
async function readWorkbook(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const sheets = new Map();
  for (const [name, path] of sheetMap) sheets.set(name, await zip.file(path).async("string"));
  return {
    sheetNames: [...sheetMap.keys()],
    monthTabs: [...sheetMap.keys()].filter((name) => getMonthTabSequence(3).includes(name)),
    formula: (sheet, ref) => (new RegExp(`<c r="${ref}"[^>]*><f[^>]*>([^<]*)</f>`).exec(sheets.get(sheet)) || [])[1],
    value: (sheet, ref) => readCellValue(sheets.get(sheet), ref, sharedStrings),
  };
}

const PACKAGES = [
  {
    name: "ltd at the template's March year end",
    product: "ltd",
    taxData: "ltd-2026.toml",
    yearEnd: new Date(Date.UTC(2027, 2, 31)),
    yearEndMonth: 3,
  },
  { name: "ltd at a June year end", product: "ltd", taxData: "ltd-2026.toml", yearEnd: new Date(Date.UTC(2026, 5, 30)), yearEndMonth: 6 },
  {
    name: "ltd at a December year end",
    product: "ltd",
    taxData: "ltd-2026.toml",
    yearEnd: new Date(Date.UTC(2026, 11, 31)),
    yearEndMonth: 12,
  },
  { name: "se", product: "se", taxData: "se-2026-2027.toml", yearEnd: new Date(Date.UTC(2027, 3, 5)), yearEndMonth: 0 },
];

describe.each(PACKAGES)("the blank Payslips workbook for $name", (pkg) => {
  let book;
  let opens;

  beforeAll(async () => {
    const built = await blankPayslips(pkg);
    book = await readWorkbook(built.buffer);
    opens = serial(built.payrollYearOpens);
  }, 120000);

  it("dates every weekly payroll block inside the package's own payroll year", () => {
    const outside = [];
    book.monthTabs.forEach((tab, monthIndex) => {
      for (let week = 0; week < PAYROLL_WEEKS_PER_MONTH[monthIndex]; week++) {
        for (const column of ["K", "M"]) {
          const ref = `${column}${9 + 10 * week}`;
          const value = book.value(tab, ref);
          // The last week of the last tab runs a few days past 5 April, which
          // is why the Admin calendar itself carries 380 rows.
          if (typeof value !== "number" || value < opens || value > opens + 380) outside.push(`${tab}!${ref} = ${value}`);
        }
      }
    });
    expect(outside).toEqual([]);
  });

  it("never ends a payroll block before it starts", () => {
    const backwards = [];
    book.monthTabs.forEach((tab, monthIndex) => {
      for (let block = 0; block <= PAYROLL_WEEKS_PER_MONTH[monthIndex]; block++) {
        const row = 9 + 10 * block;
        const first = book.value(tab, `K${row}`);
        const last = book.value(tab, `M${row}`);
        if (!(last >= first)) backwards.push(`${tab}: K${row} = ${first}, M${row} = ${last}`);
      }
    });
    expect(backwards).toEqual([]);
  });

  it("gives each tab's monthly block its own whole month", () => {
    // The tabs run consecutive months and each block covers the month it is
    // named for -- except the first block of a package whose accounting period
    // opens with the payroll year, which starts on 6 April with it. A leap
    // February leaves the calendar's fixed rows one day short of the month
    // end, which is the only shortfall allowed for.
    let previous = null;
    book.monthTabs.forEach((tab, monthIndex) => {
      const row = 9 + 10 * PAYROLL_WEEKS_PER_MONTH[monthIndex];
      const first = dateOf(book.value(tab, `K${row}`));
      if (monthIndex > 0) expect(first.getUTCDate(), `${tab}!K${row}`).toBe(1);
      const monthEnd = serial(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)));
      expect(monthEnd - book.value(tab, `M${row}`), `${tab}!M${row} against the end of its month`).toBeLessThanOrEqual(1);
      expect(monthEnd - book.value(tab, `M${row}`), `${tab}!M${row} against the end of its month`).toBeGreaterThanOrEqual(0);
      const months = first.getUTCFullYear() * 12 + first.getUTCMonth();
      if (previous !== null) expect(months, `${tab} follows the month before it`).toBe(previous + 1);
      previous = months;
    });
  });

  it("opens the first weekly block on 6 April and closes it on the Sunday after", () => {
    const firstTab = book.monthTabs[0];
    expect(book.value(firstTab, "K9")).toBe(opens);
    const closes = book.value(firstTab, "M9");
    expect(closes).toBe(opens + (7 - isoWeekday(dateOf(opens))));
    expect(isoWeekday(dateOf(closes))).toBe(7);
  });

  it("prints the first block's own week end on the payslip page", () => {
    expect(book.value(PAYSLIP_PRINT_SHEET, PAYSLIP_PRINT_CELLS.periodEnd)).toBe(book.value(book.monthTabs[0], "M9"));
  });

  it("captions the Employee sheet with the payroll year's two ends", () => {
    expect(book.value("Employee", "M9")).toBe(opens);
    expect(book.value("Employee", "O9")).toBe(serial(new Date(Date.UTC(dateOf(opens).getUTCFullYear() + 1, 3, 5))));
  });

  it("dates each PAYE schedule row from the same payroll year", () => {
    PAYE_SCHEDULE_MONTH_TABS.forEach((_, taxMonth) => {
      const row = PAYE_SCHEDULE_FIRST_ROW + taxMonth;
      expect(book.value("Payment", `B${row}`)).toBe(opens + PAYE_MONTH_END_DAYS[taxMonth]);
      expect(book.value("Payment", `C${row}`)).toBe(opens + PAYE_DUE_DATE_DAYS[taxMonth]);
    });
  });

  it("numbers the online filing months from the payroll year the calendar opens in", () => {
    const code = (dateOf(opens).getUTCFullYear() - 1999) * 100;
    expect(book.value("Payment", `M${PAYE_SCHEDULE_FIRST_ROW}`)).toBe(code + 1);
    expect(book.value("Payment", `M${PAYE_SCHEDULE_FIRST_ROW + 11}`)).toBe(code + 12);
  });

  it("sums the month tab named for the calendar month each tax month ends in", () => {
    PAYE_SCHEDULE_MONTH_TABS.forEach((tab, taxMonth) => {
      const row = PAYE_SCHEDULE_FIRST_ROW + taxMonth;
      const monthEnd = dateOf(book.value("Payment", `B${row}`));
      expect(getMonthTabSequence(3)[(monthEnd.getUTCMonth() + 9) % 12]).toBe(tab);
      for (const column of ["D", "E", "H"]) {
        for (const reference of book.formula("Payment", `${column}${row}`).split("+")) {
          expect(reference.split("!")[0]).toBe(tab);
        }
      }
    });
  });

  it("reads each tab's director block at the row that tab's own month gives it", () => {
    PAYE_SCHEDULE_MONTH_TABS.forEach((tab, taxMonth) => {
      const row = PAYE_SCHEDULE_FIRST_ROW + taxMonth;
      const directorRow = 20 + 10 * PAYROLL_WEEKS_PER_MONTH[book.monthTabs.indexOf(tab)];
      expect(book.formula("Payment", `F${row}`)).toBe(["AD", "AE", "AF", "AG"].map((c) => `${tab}!${c}${directorRow}`).join("+"));
      expect(book.formula("Payment", `G${row}`)).toBe(["AE", "AF", "AG"].map((c) => `${tab}!${c}${directorRow + 2}`).join("+"));
    });
  });
});

// A March year end names its tabs the way the template already does, so the
// schedule has nothing to repoint and must hand the workbook back byte for
// byte.
describe("the PAYE schedule at the template's own year end", () => {
  it("hands a March package's workbook back untouched", async () => {
    const buffer = readFileSync(resolve(APP_DIR, "templates", "ltd", "Payslips.xlsx"));
    expect(await realignPayslipsPaymentSchedule(buffer, 3)).toBe(buffer);
  });

  it("refuses a workbook whose schedule no longer reads the tab the rename left it on", async () => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(APP_DIR, "templates", "ltd", "Payslips.xlsx")));
    const paymentPath = (await buildSheetMap(zip)).get("Payment");
    const xml = await zip.file(paymentPath).async("string");
    zip.file(paymentPath, xml.replace("<f>Apr!N1</f>", "<f>Apr!N2</f>"));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    await expect(realignPayslipsPaymentSchedule(buffer, 6)).rejects.toThrow(/Payment E4 reads Apr!N2/);
  });
});

// The evaluator computes each cached date from the workbook's own formula, so
// the only honest oracle is the engine those formulas were written for.
// Requires: LibreOffice installed (brew install --cask libreoffice)
const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

describeCalc.each(PACKAGES)("recalculating the blank Payslips workbook for $name", (pkg) => {
  let before;
  let after;
  let workDir;

  beforeAll(async () => {
    const built = await blankPayslips(pkg);
    before = await readWorkbook(built.buffer);
    workDir = mkdtempSync(join(tmpdir(), "payslips-chain-"));
    const bookPath = join(workDir, "Payslips.xlsx");
    writeFileSync(bookPath, built.buffer);
    xslRoundtrip(getLibreOffice(), `file://${join(workDir, "profile")}`, workDir, bookPath);
    after = await readWorkbook(readFileSync(bookPath));
  }, 300000);

  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  it("moves no cached date the generator wrote", () => {
    const moved = [];
    for (const { sheet, ref } of payslipsChainedDateCells(before.monthTabs)) {
      const cached = before.value(sheet, ref);
      const recalculated = after.value(sheet, ref);
      if (cached !== recalculated) moved.push(`${sheet}!${ref}: cached ${cached}, recalculated ${recalculated}`);
    }
    expect(moved).toEqual([]);
  });
});

// The checks reading the schedule are only real if each one fails on its own
// when the cell it reads is corrupted in a recalculated package.
describeCalc("se Payslips PAYE schedule checks against the recalculated package", () => {
  const SE_DIR = resolve(APP_DIR, "templates", "se");
  let results;
  let checks;
  let taxData;
  let expected;
  let savedDir;

  function checksWithCorruptedCell(cellRef, value) {
    const key = "Payslips.xlsx!Payment";
    const corrupted = { ...results, [key]: { ...results[key], [cellRef]: value } };
    return seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
  }

  const failureNames = (list) => list.filter((c) => !c.pass && c.severity !== "warning").map((c) => c.name);

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
    savedDir = mkdtempSync(join(tmpdir(), "se-paye-schedule-"));
    results = await runMultiFileSpreadsheet(
      fileBuffers,
      seCellWrites(scenario, new Date(taxData.tax_year.start).getUTCFullYear()),
      seReads(),
      "Financialaccounts.xlsx",
      { ...seOptions(), saveRecalculatedTo: savedDir },
    );
    checks = seCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 600000);

  afterAll(() => {
    if (savedDir) rmSync(savedDir, { recursive: true, force: true });
  });

  it("passes every PAYE schedule check on the intact book", () => {
    const scheduleChecks = checks.filter((c) => c.name.startsWith("Payslips!Payment") && c.severity !== "warning");
    expect(scheduleChecks).toHaveLength(96);
    for (const c of scheduleChecks) {
      expect(c.pass, `${c.name}: expected ${c.expected}, actual ${c.actual}`).toBe(true);
    }
  });

  it.each([
    ["B4", ["Payslips!Payment B4 tax month 1 ends in Apr"]],
    ["C4", ["Payslips!Payment C4 tax month 1 is due on the 19th after it"]],
    ["B15", ["Payslips!Payment B15 tax month 12 ends in Mar"]],
    ["D6", ["Payslips!Payment jun D6 NI due", "Payslips!Payment D6 NI due is the jun tab's own"]],
    ["E6", ["Payslips!Payment jun E6 income tax due", "Payslips!Payment E6 income tax due is the jun tab's own"]],
    ["I6", ["Payslips!Payment jun I6 total amount payable", "Payslips!Payment I6 total payable is the jun tab's own"]],
  ])("corrupting Payslips.xlsx!Payment!%s fails only its own schedule checks", async (cellRef, names) => {
    for (const name of names) expect(checks.find((c) => c.name === name)?.pass, name).toBe(true);

    const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, "Payslips.xlsx")));
    const paymentPath = (await buildSheetMap(zip)).get("Payment");
    const xml = await zip.file(paymentPath).async("string");
    const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v[^>]*>)([^<]*)(</v>)`, "s");
    expect(pattern.test(xml)).toBe(true);
    zip.file(paymentPath, xml.replace(pattern, (_m, pre, _old, post) => `${pre}12345${post}`));

    const reloaded = await JSZip.loadAsync(await zip.generateAsync({ type: "nodebuffer" }));
    const value = readCellValue(await reloaded.file(paymentPath).async("string"), cellRef, await loadSharedStrings(reloaded));
    expect(failureNames(checksWithCorruptedCell(cellRef, value)).sort()).toEqual([...names].sort());
  });
});
