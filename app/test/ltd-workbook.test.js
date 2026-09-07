// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The writer on the Company package: thirteen workbooks and the dividend
// voucher, composed from the templates the way the CLI composes a generated
// package. Two year ends are covered, because a company picks its own: the
// March one the templates carry, and one that moves every month tab, every
// link that names a tab, the payroll calendar and the VAT interface. No
// LibreOffice — the workbooks are read as they are written, and each asks the
// spreadsheet app to recalculate on open.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

import {
  saveWorkbook,
  saveWorkbookFiles,
  savePackageZip,
  taxYearFileName,
  BookFieldError,
  SingleFileOnlyError,
} from "../lib/product-workbook.js";
import { generateSpreadsheet, applyYearEndSequence, setFullCalcOnLoad, toExcelSerial } from "../lib/generator.js";
import { applyCellWrites, buildSheetMap, loadSharedStrings, readCellValue } from "../lib/spreadsheet-runner.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { cellWrites } from "../products/ltd.js";
import { monthTabOrder } from "../lib/ltd-layout.js";
import { LINK_ORDER, refreshWorkbookLinkCaches, resultsReader } from "../lib/link-caches.js";
import { calculateLinkCells } from "../lib/diya-gl-calculator.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");
const NODE = process.execPath;

const MARCH_BOOK = "examples/precision-code-ltd/full";
const MARCH_DIR_NAME = "GB Accounts Company 2026-03-31 (Mar26) Excel 2007";
// The populated October package the reconciliation matrix copies here sits
// in whichever year the matrix last generated for, so its year end is read
// off the book it exports to rather than pinned.
const OCTOBER_PACKAGE = "examples/ltd-latest";

// The directory name packages/ gives a Company package for a year end,
// spelled out by hand so the saver's own naming is checked against it.
function companyPackageDirName(yearEnd) {
  const date = new Date(yearEnd);
  const month = date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `GB Accounts Company ${yearEnd} (${month}${String(date.getUTCFullYear()).slice(2)}) Excel 2007`;
}

const scratchDirs = [];
function scratchDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

afterAll(() => {
  while (scratchDirs.length > 0) rmSync(scratchDirs.pop(), { recursive: true, force: true });
});

// The steps the CLI runs over one generated package (app/bin/generate.js):
// the year's rates into the sheets that carry them, the year-end sequence,
// the scenario's cells, and the recalculate-on-open flag every workbook gets.
// A difference here means the writer and the CLI have drifted apart.
//
// The writer (product-workbook.js's composeFiles) also refreshes every
// link-bearing file's external link caches from the calculator once every
// file is composed, so the two paths are mirrored here to the same point:
// generate.js does not refresh (CI recalculates through LibreOffice instead),
// so composing "the generate path" and then applying that same refresh is
// what makes the two comparable byte for byte.
async function packageTheGeneratePathComposes(book, lines, taxYearName, yearEndMonth) {
  const productMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates/ltd/meta.toml"), "utf8"));
  const taxData = parseTOML(readFileSync(resolve(APP_DIR, `data/${taxYearName}.toml`), "utf8"));
  const endDate = new Date(book.documentInfo.periodCoveredEnd);
  const scenario = diyaGlToScenario(book, lines, "ltd");
  const writes = cellWrites(scenario, endDate.getUTCFullYear() - 1, yearEndMonth);

  const files = [];
  for (const templateFile of productMeta.template.files) {
    const fileKey = templateFile.replace(".xlsx", "").replace(".docx", "").toLowerCase();
    const sheetsConfig = productMeta.sheets[fileKey];

    let buffer = readFileSync(resolve(APP_DIR, "templates/ltd", templateFile));
    if (sheetsConfig) buffer = await generateSpreadsheet(buffer, taxData, sheetsConfig);
    if (templateFile.endsWith(".xlsx")) {
      buffer = await applyYearEndSequence(buffer, templateFile, sheetsConfig, yearEndMonth, endDate, taxData.financial_year);
      if (writes[templateFile]) buffer = await applyCellWrites(buffer, writes[templateFile]);
      buffer = await setFullCalcOnLoad(buffer);
    }
    files.push({ name: templateFile, bytes: buffer });
  }

  const reader = resultsReader(calculateLinkCells(book, lines, "ltd", taxData, scenario));
  for (const name of LINK_ORDER.ltd) {
    const file = files.find((entry) => entry.name === name);
    file.bytes = (await refreshWorkbookLinkCaches(file.bytes, reader)).bytes;
  }
  return files;
}

function bookAt(dir) {
  return loadDiyaGlData(resolve(ROOT, dir));
}

function workbookNamed(files, name) {
  const file = files.find((entry) => entry.name === name);
  if (!file) throw new Error(`the writer produced no ${name}`);
  return file.bytes;
}

async function sheetXml(bytes, sheetName) {
  const zip = await JSZip.loadAsync(bytes);
  const path = (await buildSheetMap(zip)).get(sheetName);
  if (!path) throw new Error(`the workbook has no ${sheetName} sheet`);
  return { xml: await zip.file(path).async("string"), sharedStrings: await loadSharedStrings(zip) };
}

async function sheetNames(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  return [...(await zip.file("xl/workbook.xml").async("string")).matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
}

async function cellFormula(bytes, sheetName, cellRef) {
  const { xml } = await sheetXml(bytes, sheetName);
  const cell = xml.match(new RegExp(`<c r="${cellRef}"[^>]*>.*?</c>`, "s"));
  const formula = cell && cell[0].match(/<f>([^<]*)<\/f>/);
  return formula ? formula[1] : null;
}

async function cellValue(bytes, sheetName, cellRef) {
  const { xml, sharedStrings } = await sheetXml(bytes, sheetName);
  return readCellValue(xml, cellRef, sharedStrings);
}

describe("the Company package for the year end the templates carry", () => {
  let saved;
  let packaged;

  beforeAll(async () => {
    const { book, lines } = bookAt(MARCH_BOOK);
    saved = await saveWorkbookFiles(book, lines);
    packaged = await savePackageZip(book, lines);
  }, 600000);

  it("writes the same bytes the generate path composes, the voucher included", async () => {
    const { book, lines } = bookAt(MARCH_BOOK);
    const composed = await packageTheGeneratePathComposes(book, lines, "ltd-2025", 3);

    expect(saved.dirName).toBe(MARCH_DIR_NAME);
    expect(saved.files.map((file) => file.name)).toEqual(composed.map((file) => file.name));
    for (const [index, file] of saved.files.entries()) {
      const difference = Buffer.compare(Buffer.from(file.bytes), Buffer.from(composed[index].bytes));
      expect(difference, `${file.name} differs from the file the generate path composes`).toBe(0);
    }
  }, 600000);

  it("holds thirteen workbooks and the dividend voucher under the package's own directory", async () => {
    expect(packaged.filename).toBe(`${MARCH_DIR_NAME}.zip`);

    const zip = await JSZip.loadAsync(packaged.zip);
    const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    for (const entry of entries) expect(entry.startsWith(`${MARCH_DIR_NAME}/`)).toBe(true);

    const held = entries.map((entry) => entry.slice(MARCH_DIR_NAME.length + 1));
    expect(held.filter((name) => name.endsWith(".xlsx"))).toHaveLength(13);
    expect(held.filter((name) => name.endsWith(".docx"))).toEqual(["Dividend Voucher.docx"]);
    expect(held.filter((name) => name.endsWith(".pdf"))).toEqual([]);
  }, 600000);

  it("copies the dividend voucher out of the template byte for byte", () => {
    const template = readFileSync(resolve(APP_DIR, "templates/ltd/Dividend Voucher.docx"));
    const written = workbookNamed(saved.files, "Dividend Voucher.docx");
    expect(Buffer.compare(Buffer.from(written), template)).toBe(0);
  });

  it("asks the spreadsheet app to recalculate every one of the thirteen workbooks on open", async () => {
    const workbooks = saved.files.filter((file) => file.name.endsWith(".xlsx"));
    expect(workbooks).toHaveLength(13);

    for (const file of workbooks) {
      const zip = await JSZip.loadAsync(file.bytes);
      const workbookXml = await zip.file("xl/workbook.xml").async("string");
      expect(workbookXml, `${file.name} does not ask the spreadsheet app to recalculate`).toContain('fullCalcOnLoad="1"');
    }
  }, 600000);

  // TXN-0918, the cash top-up's counter leg, is coded "BC" -- Cashaccount's
  // own transfer letter -- and dated 2025-06-10, not the period's first day
  // (2025-04-01). cellWrites() must read that date to tell it apart from a
  // real opening balance: written as one, it would reset June's A1 to 100
  // instead of carrying May's closing forward, the same account also
  // losing the payment row a real bank statement would show for it.
  it("keeps the cash top-up's counter leg a June transfer, not a second opening balance", async () => {
    const currentAccount = workbookNamed(saved.files, "Currentaccount.xlsx");

    const mayClosing = await cellValue(currentAccount, "May", "A2");
    const juneOpening = await cellValue(currentAccount, "Jun", "A1");
    expect(juneOpening).toBe(mayClosing);
    expect(juneOpening).not.toBe(100);

    const { xml, sharedStrings } = await sheetXml(currentAccount, "Jun");
    let transferRow = null;
    for (let row = 6; row <= 300 && transferRow === null; row++) {
      if (readCellValue(xml, `W${row}`, sharedStrings) === "BC") transferRow = row;
    }
    expect(transferRow, "no June payment row is coded BC").not.toBeNull();
    expect(readCellValue(xml, `X${transferRow}`, sharedStrings)).toBe(100);
  }, 600000);
});

describe("the Company package for a year end that moves the month tabs", () => {
  let saved;
  let octoberYearEnd;

  beforeAll(async () => {
    // The populated October package the reconciliation matrix builds, read
    // back into a book the same way a customer's own upload is.
    const exported = scratchDir("ltd-october-book-");
    execFileSync(
      NODE,
      [resolve(ROOT, "app/bin/export.js"), "--package", "ltd", "--source-dir", OCTOBER_PACKAGE, "--output-dir", exported],
      {
        cwd: ROOT,
        encoding: "utf8",
      },
    );
    const { book, lines } = loadDiyaGlData(exported);
    octoberYearEnd = book.documentInfo.periodCoveredEnd.toISOString().slice(0, 10);
    expect(octoberYearEnd.slice(5), "ltd-latest is an October package").toBe("10-31");
    saved = await saveWorkbookFiles(book, lines);
  }, 600000);

  it("names the package for the book's own year end", () => {
    expect(saved.dirName).toBe(companyPackageDirName(octoberYearEnd));
  });

  it("puts the ledger month tabs in the period's own order", async () => {
    expect(await sheetNames(workbookNamed(saved.files, "Sales.xlsx"))).toEqual([
      "OpeningDebtors",
      "Nov",
      "Dec",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "ClosingDebtors",
    ]);
  });

  it("opens the payroll calendar on the period's first month", async () => {
    expect(await cellValue(workbookNamed(saved.files, "Payslips.xlsx"), "Admin", "A2")).toBe("Nov");
  });

  it("points the VAT interface at the first month's tab", async () => {
    const formula = await cellFormula(workbookNamed(saved.files, "Vatreturns.xlsx"), "Vatinterface", "M4");
    expect(formula).toContain("[2]Nov!");
  });

  it("points the fixed asset reconciliation at the final month's tab", async () => {
    const formula = await cellFormula(workbookNamed(saved.files, "Fixedassets.xlsx"), "FAreconciliation", "E13");
    expect(formula).toBe("[2]Oct!$AI$2");
  });

  it("sets the one date cell the rest of the Admin sheet is computed from", async () => {
    expect(await cellValue(workbookNamed(saved.files, "Financialaccounts.xlsx"), "Admin", "F21")).toBe(
      toExcelSerial(new Date(octoberYearEnd)),
    );
  });
});

// TXN-0918, the cash top-up's counter leg, sits two calendar months after
// the master's own period start (April 2025 to June 2025), so it lands on
// whichever tab sits at that same period-relative position once the year
// end shifts every date -- monthTabOrder(yearEndMonth) names the twelve
// tabs in the order cellWrites' own shiftDate puts them in, so position 0
// is always the opening tab and position 2 is always the counter leg's,
// whatever year end generates the package. isLtdOpeningBankLine's period
// start used to be reconstructed from targetStartYear and yearEndMonth,
// which drifted from cellWrites' own shiftDate arithmetic whenever the
// month shift crossed a calendar year boundary shiftDate does not (see
// app/products/ltd.js) -- every year end here but March exercises that.
describe("the BC gate holds at every year end the generator supports", () => {
  const { book, lines } = bookAt(MARCH_BOOK);

  // March: the templates' own native tab order (LT-T25's own proof). May:
  // the year end that first exposed the drift. June and February: two of
  // the three representative rewrite classes generate-ltd.yml's own
  // reconciliation matrix runs (the third, the latest year end, is March
  // or June depending on when this runs).
  const YEAR_ENDS = [3, 5, 6, 2];

  for (const yearEndMonth of YEAR_ENDS) {
    it(`keeps Currentaccount's opening balance and the counter leg's transfer apart at a year end in month ${yearEndMonth}`, async () => {
      const composed = await packageTheGeneratePathComposes(book, lines, "ltd-2025", yearEndMonth);
      const currentAccount = workbookNamed(composed, "Currentaccount.xlsx");

      const tabs = monthTabOrder(yearEndMonth);
      const openingTab = tabs[0];
      const transferTab = tabs[2];
      const priorTab = tabs[1];

      const opening = await cellValue(currentAccount, openingTab, "A1");
      expect(typeof opening).toBe("number");
      expect(opening).toBeGreaterThan(0);

      const priorClosing = await cellValue(currentAccount, priorTab, "A2");
      const transferTabOpening = await cellValue(currentAccount, transferTab, "A1");
      expect(transferTabOpening).toBe(priorClosing);
      expect(transferTabOpening).not.toBe(100);

      const { xml, sharedStrings } = await sheetXml(currentAccount, transferTab);
      let transferRow = null;
      for (let row = 6; row <= 300 && transferRow === null; row++) {
        if (readCellValue(xml, `W${row}`, sharedStrings) === "BC") transferRow = row;
      }
      expect(transferRow, `no ${transferTab} payment row is coded BC`).not.toBeNull();
      expect(readCellValue(xml, `X${transferRow}`, sharedStrings)).toBe(100);
    }, 600000);
  }
});

describe("the tax data file a company's year end names", () => {
  it("takes the financial year of the 1 April on or before the year end", () => {
    expect(taxYearFileName(new Date("2026-03-31"), "ltd")).toBe("ltd-2025");
    expect(taxYearFileName(new Date("2026-04-30"), "ltd")).toBe("ltd-2026");
    expect(taxYearFileName(new Date("2026-12-31"), "ltd")).toBe("ltd-2026");
    expect(taxYearFileName(new Date("2027-01-31"), "ltd")).toBe("ltd-2026");
  });
});

describe("a Company book the writer cannot use", () => {
  function refusingResources() {
    const reads = [];
    return {
      reads,
      async readText(path) {
        reads.push(path);
        throw new Error("the save path read a resource before checking the book");
      },
      async readBinary(path) {
        reads.push(path);
        throw new Error("the save path read a resource before checking the book");
      },
    };
  }

  it("refuses a period that is not twelve whole months before it reads anything", async () => {
    const { book, lines } = bookAt(MARCH_BOOK);
    book.documentInfo.periodCoveredEnd = new Date("2026-02-28");
    const resources = refusingResources();

    await expect(savePackageZip(book, lines, { resources })).rejects.toThrow(BookFieldError);
    await expect(savePackageZip(book, lines, { resources })).rejects.toThrow("2025-04-01 to 2026-02-28");
    expect(resources.reads).toEqual([]);
  });

  it("refuses a period that does not open on the first of a month", async () => {
    const { book, lines } = bookAt(MARCH_BOOK);
    book.documentInfo.periodCoveredStart = new Date("2025-04-06");
    book.documentInfo.periodCoveredEnd = new Date("2026-04-05");
    await expect(savePackageZip(book, lines)).rejects.toThrow("2025-04-06 to 2026-04-05");
  });

  it("refuses to hand back one workbook, naming the product", async () => {
    const { book, lines } = bookAt(MARCH_BOOK);
    await expect(saveWorkbook(book, lines)).rejects.toThrow(SingleFileOnlyError);
    await expect(saveWorkbook(book, lines)).rejects.toThrow("a Company book saves as its package zip");
  }, 600000);
});

describe("the report the saved package produces", () => {
  it("carries the same writer-input cells the book's own report does", async () => {
    const { book, lines } = bookAt(MARCH_BOOK);
    const { files } = await saveWorkbookFiles(book, lines);

    const packageDir = resolve(scratchDir("ltd-saved-package-"), MARCH_DIR_NAME);
    mkdirSync(packageDir, { recursive: true });
    for (const file of files) writeFileSync(resolve(packageDir, file.name), Buffer.from(file.bytes));

    const reportBin = resolve(ROOT, "app/bin/report.js");
    const fromSaved = scratchDir("ltd-report-saved-");
    const fromBook = scratchDir("ltd-report-data-");
    execFileSync(NODE, [reportBin, "--package", "ltd", "--source-dir", packageDir, "--mode", "saved", "--output-dir", fromSaved], {
      cwd: ROOT,
      encoding: "utf8",
    });
    execFileSync(NODE, [reportBin, "--package", "ltd", "--data", MARCH_BOOK, "--output-dir", fromBook], { cwd: ROOT, encoding: "utf8" });

    // The cells the writer itself fills: the opening balance sheet, the board
    // minute, the register of members and the payroll employer details. Every
    // other cell of a saved package is a formula the spreadsheet app has yet
    // to recalculate.
    const writerInputs = /^cell\/.*(OpenAccounts|Boardmeeting|RegisterofMembers|Payslips\.xlsx!Employee)!/;
    const keysIn = (dir) =>
      JSON.parse(readFileSync(resolve(dir, "report.json"), "utf8"))
        .values.map((value) => value.key)
        .filter((key) => writerInputs.test(key))
        .sort();

    expect(keysIn(fromSaved)).toEqual(keysIn(fromBook));
    expect(keysIn(fromSaved).length).toBeGreaterThan(0);
  }, 600000);
});
