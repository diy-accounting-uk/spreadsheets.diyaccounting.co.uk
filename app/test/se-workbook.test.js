// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The writer on the Self Employed package: nine workbooks composed from the
// templates the way the CLI composes a generated package, the entries none of
// those workbooks has a cell for, and the two things a saved package has to
// survive — being read back as the book it came from, and agreeing with the
// engine on every cell the writer filled. No LibreOffice: the workbooks are
// read as they are written, and each asks the spreadsheet app to recalculate
// on open.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";

import { saveWorkbookFiles, savePackageZip, taxYearFileName } from "../lib/product-workbook.js";
import { generateSpreadsheet, applyYearEndSequence, setFullCalcOnLoad } from "../lib/generator.js";
import { applyCellWrites } from "../lib/spreadsheet-runner.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { extractBookFromFile } from "../bin/export.js";
import { cellWrites, writerSkips } from "../products/se.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");
const NODE = process.execPath;

const ADVANCED = "examples/precision-code-ltd/advanced";
const BRICKWORK = "examples/brickwork-pro/se-nonvat";
const DIR_NAME = "GB Accounts Self Employed 2026-04-05 (Apr26) Excel 2007";

const scratchDirs = [];
function scratchDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

afterAll(() => {
  while (scratchDirs.length > 0) rmSync(scratchDirs.pop(), { recursive: true, force: true });
});

function bookAt(dir) {
  return loadDiyaGlData(resolve(ROOT, dir));
}

function workbookNamed(files, name) {
  const file = files.find((entry) => entry.name === name);
  if (!file) throw new Error(`the writer produced no ${name}`);
  return Buffer.from(file.bytes);
}

// The year the writes are dated into is the year the book's own period opens
// in, which for a self-employment year is the year the tax file declares.
function targetStartYearOf(book) {
  return new Date(book.documentInfo.periodCoveredStart).getUTCFullYear();
}

// The steps the CLI runs over one generated package (app/bin/generate.js):
// the year's rates into the sheets that carry them, the year-end sequence,
// the scenario's cells, and the recalculate-on-open flag every workbook gets.
// A difference here means the writer and the CLI have drifted apart.
async function packageTheGeneratePathComposes(book, lines, targetStartYear) {
  const productMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates/se/meta.toml"), "utf8"));
  const taxYearName = taxYearFileName(new Date(book.documentInfo.periodCoveredEnd));
  const taxData = parseTOML(readFileSync(resolve(APP_DIR, `data/${taxYearName}.toml`), "utf8"));
  const endDate = new Date(taxData.tax_year.end);
  const writes = cellWrites(diyaGlToScenario(book, lines, "se"), targetStartYear);

  const files = [];
  for (const templateFile of productMeta.template.files) {
    const fileKey = templateFile.replace(".xlsx", "").toLowerCase();
    const sheetsConfig = productMeta.sheets[fileKey];

    let buffer = readFileSync(resolve(APP_DIR, "templates/se", templateFile));
    if (sheetsConfig) buffer = await generateSpreadsheet(buffer, taxData, sheetsConfig);
    buffer = await applyYearEndSequence(buffer, templateFile, sheetsConfig, 0, endDate, taxData.tax_year);
    if (writes[templateFile]) buffer = await applyCellWrites(buffer, writes[templateFile]);
    files.push({ name: templateFile, bytes: await setFullCalcOnLoad(buffer) });
  }
  return files;
}

describe("the nine workbooks a Self Employed book is written into", () => {
  for (const [name, dir] of [
    ["precision-code-ltd", ADVANCED],
    ["brickwork-pro", BRICKWORK],
  ]) {
    it(`writes ${name} to the same bytes the generate path composes`, async () => {
      const { book, lines } = bookAt(dir);
      const saved = await saveWorkbookFiles(book, lines);
      const composed = await packageTheGeneratePathComposes(book, lines, targetStartYearOf(book));

      expect(saved.dirName).toBe(DIR_NAME);
      expect(saved.files.map((file) => file.name)).toEqual(composed.map((file) => file.name));
      for (const [index, file] of saved.files.entries()) {
        const difference = Buffer.compare(Buffer.from(file.bytes), Buffer.from(composed[index].bytes));
        expect(difference, `${file.name} differs from the file the generate path composes`).toBe(0);
      }
    }, 600000);
  }

  it("dates the writes into the year the book's own period opens in", async () => {
    const { book, lines } = bookAt(ADVANCED);
    const taxYearName = taxYearFileName(new Date(book.documentInfo.periodCoveredEnd));
    const taxData = parseTOML(readFileSync(resolve(APP_DIR, `data/${taxYearName}.toml`), "utf8"));

    // A self-employment year opens on 6 April, so the year the tax file
    // declares and the year the book's period opens in are the same year.
    expect(new Date(taxData.tax_year.start).getUTCFullYear()).toBe(targetStartYearOf(book));
    expect(targetStartYearOf(book)).toBe(2025);

    // And the year reaches the payroll calendar: composed a year out, the
    // employee start dates land on different days.
    const saved = await saveWorkbookFiles(book, lines);
    const yearEarly = await packageTheGeneratePathComposes(book, lines, 2024);
    const payslips = "Payslips.xlsx";
    expect(Buffer.compare(workbookNamed(saved.files, payslips), workbookNamed(yearEarly, payslips))).not.toBe(0);
  }, 600000);
});

describe("an entry none of the nine workbooks has a cell for", () => {
  // Each of these leaves one entry out of the package and writes everything
  // else. The files the entry never reached are the same bytes they are
  // without it, so a skip is a hole of exactly one entry, not a save that
  // quietly stopped.
  async function savedWith(dir, change) {
    const original = bookAt(dir);
    const changed = change({ book: structuredClone(original.book), lines: structuredClone(original.lines) });
    const before = await saveWorkbookFiles(original.book, original.lines);
    const after = await saveWorkbookFiles(changed.book, changed.lines);
    const skips = writerSkips(diyaGlToScenario(changed.book, changed.lines, "se"));
    const unmoved = before.files
      .filter((file, index) => Buffer.compare(Buffer.from(file.bytes), Buffer.from(after.files[index].bytes)) === 0)
      .map((file) => file.name);
    return { skips, unmoved };
  }

  function bankLine(overrides) {
    return {
      "entryNumber": "TXN-9001",
      "sourceJournalID": "bank",
      "postingDate": "2025-04-15",
      "accountMainID": "1200",
      "debitCreditCode": "C",
      "amount": 250,
      "documentType": "bank-statement",
      "documentReference": "BNK-9001",
      "detailComment": "Somewhere else",
      "lineItemComment": "A payment with no home",
      "taxCode": "OS",
      "taxRate": 0,
      "diya-gl:bankCode": "CR",
      "diya-gl:bankAccountID": "1200",
      ...overrides,
    };
  }

  it("leaves out a bank line under a code the workbook analyses no column for", async () => {
    const line = bankLine({ "diya-gl:bankCode": "Q" });
    const { skips, unmoved } = await savedWith(ADVANCED, ({ book, lines }) => ({ book, lines: [...lines, line] }));

    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ kind: "bank", code: "Q", amount: 250 });
    expect(skips[0].why).toContain("Bank.xlsx analyses no payment");
    expect(unmoved).toHaveLength(9);
  }, 600000);

  it("leaves out a fixed asset purchase past the Schedule's new-asset rows", async () => {
    // The book already fills all five rows, so a sixth purchase reaches the
    // Purchases journal and stops there.
    const line = {
      entryNumber: "TXN-9002",
      sourceJournalID: "purchases",
      postingDate: "2025-11-20",
      accountMainID: "5900",
      amount: 4200,
      documentType: "invoice",
      documentReference: "PUR-FA-009",
      detailComment: "One Rig Too Many Ltd",
      lineItemComment: "A sixth asset bought in the year",
      taxCode: "S",
      taxRate: 0.2,
    };
    const { skips, unmoved } = await savedWith(ADVANCED, ({ book, lines }) => ({ book, lines: [...lines, line] }));

    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ kind: "assetPurchase", date: "2025-11-20", code: "fa", amount: 4200 });
    expect(unmoved).toContain("Fixedassets.xlsx");
    expect(unmoved).not.toContain("Purchases.xlsx");
  }, 600000);

  it("leaves out a disposal with no asset row to sit on", async () => {
    // Two assets are brought forward and one is already sold, so the third
    // disposal has no row of its own to be written onto.
    const disposal = (entryNumber, reference) => ({
      entryNumber,
      sourceJournalID: "sales",
      postingDate: "2025-12-01",
      accountMainID: "4006",
      amount: 900,
      documentType: "invoice",
      documentReference: reference,
      detailComment: "Private buyer",
      lineItemComment: "Disposal with nowhere to go",
      taxCode: "S",
      taxRate: 0.2,
    });
    const { book, lines } = bookAt(ADVANCED);
    const seated = [...lines, disposal("TXN-9003", "INV-9903")];
    const oneTooMany = [...seated, disposal("TXN-9004", "INV-9904")];

    const skips = writerSkips(diyaGlToScenario(book, oneTooMany, "se"));
    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ kind: "assetDisposal", date: "2025-12-01", code: "fs", amount: 900 });

    // The second of the three lands on the computer row, the third on
    // nothing: the Schedule is the same bytes with it and without it.
    const withTwo = await saveWorkbookFiles(book, seated);
    const withThree = await saveWorkbookFiles(book, oneTooMany);
    const schedule = "Fixedassets.xlsx";
    expect(Buffer.compare(workbookNamed(withTwo.files, schedule), workbookNamed(withThree.files, schedule))).toBe(0);
    expect(Buffer.compare(workbookNamed(withTwo.files, "Sales.xlsx"), workbookNamed(withThree.files, "Sales.xlsx"))).not.toBe(0);
  }, 600000);

  it("leaves out an asset brought forward whose class has no block on the Schedule", async () => {
    const asset = { assetID: "SE-FA-9", class: "plantMachinery", description: "Lathe", cost: 5000, accumulatedDepreciation: 400 };
    const { skips, unmoved } = await savedWith(ADVANCED, ({ book, lines }) => ({
      book: { ...book, fixedAssets: [...book.fixedAssets, asset] },
      lines,
    }));

    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ kind: "openingFixedAsset", code: "plant", amount: 5000 });
    expect(unmoved).toHaveLength(9);
  }, 600000);

  it("leaves out an asset brought forward past its own block", async () => {
    const spare = (index) => ({
      assetID: `SE-FA-M${index}`,
      class: "motorVehicles",
      description: `Spare van ${index}`,
      cost: 1000 + index,
      accumulatedDepreciation: 0,
    });
    const extra = [1, 2, 3, 4, 5].map(spare);
    const { skips, unmoved } = await savedWith(ADVANCED, ({ book, lines }) => ({
      book: { ...book, fixedAssets: [...book.fixedAssets, ...extra] },
      lines,
    }));

    // The motor block holds five: the van already brought forward and the
    // first four spares, leaving the fifth with no row.
    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ kind: "openingFixedAsset", code: "motor", amount: 1005 });
    expect(skips[0].why).toContain("motor block");
    expect(unmoved).not.toContain("Fixedassets.xlsx");
  }, 600000);

  it("leaves out a hire purchase agreement past the HPfinance rows", async () => {
    const agreement = {
      agreementID: "HP-2025-03",
      financeCompany: "Close Brothers Asset Finance",
      supplier: "Precision Tooling Supplies",
      amountFinanced: 4000,
      adminCharges: 50,
      totalInterest: 500,
      termMonths: 12,
      startDate: "2025-12-01",
    };
    const { skips, unmoved } = await savedWith(ADVANCED, ({ book, lines }) => ({
      book: { ...book, hpAgreements: [...book.hpAgreements, agreement] },
      lines,
    }));

    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ kind: "hpAgreement", date: "2025-12-01", code: "HP-2025-03", amount: 4000 });
    expect(unmoved).toHaveLength(9);
  }, 600000);

  // Two of the conditions never reach the writer from a book: the loader
  // refuses a bank line with no side of its own, and its Self Employed filter
  // drops a line on any account but the two the package keeps a workbook for.
  // Both still reach it from a scenario, which is what the generate path
  // hands the writer, so both are proved there.
  function scenarioWithBankEntry(entry) {
    const { book, lines } = bookAt(ADVANCED);
    const scenario = diyaGlToScenario(book, lines, "se");
    scenario.bank.apr = [...scenario.bank.apr, entry];
    return { scenario, untouched: diyaGlToScenario(book, lines, "se") };
  }

  it("leaves out a bank entry that is neither a receipt nor a payment", () => {
    const entry = { date: "2025-04-20", source: "Neither one thing", code: "CR", amount: 75, account: "1200" };
    const { scenario, untouched } = scenarioWithBankEntry(entry);

    const skips = writerSkips(scenario);
    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ kind: "bank", date: "2025-04-20", code: "CR", amount: 75 });
    expect(cellWrites(scenario, 2025)["Bank.xlsx"]).toEqual(cellWrites(untouched, 2025)["Bank.xlsx"]);
  });

  it("leaves out a bank entry on an account with no workbook", () => {
    const entry = { date: "2025-04-21", source: "Somewhere else", code: "CR", direction: "out", amount: 250, account: "1210" };
    const { scenario, untouched } = scenarioWithBankEntry(entry);

    const skips = writerSkips(scenario);
    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({ kind: "bank", date: "2025-04-21", code: "CR", amount: 250 });
    expect(skips[0].why).toContain("1210");
    const writes = cellWrites(scenario, 2025);
    const withoutIt = cellWrites(untouched, 2025);
    expect(writes["Bank.xlsx"]).toEqual(withoutIt["Bank.xlsx"]);
    expect(writes["Cash.xlsx"]).toEqual(withoutIt["Cash.xlsx"]);
  });

  it("names nothing on a book every workbook has room for", () => {
    const { book, lines } = bookAt(ADVANCED);
    expect(writerSkips(diyaGlToScenario(book, lines, "se"))).toEqual([]);
  });
});

describe("the package the writer saves", () => {
  let packageDir;
  let saved;

  beforeAll(async () => {
    const { book, lines } = bookAt(ADVANCED);
    saved = await savePackageZip(book, lines);
    packageDir = resolve(scratchDir("se-saved-package-"), DIR_NAME);
    mkdirSync(packageDir, { recursive: true });
    const files = await saveWorkbookFiles(book, lines);
    for (const file of files.files) writeFileSync(resolve(packageDir, file.name), Buffer.from(file.bytes));
  }, 600000);

  it("reads back as the book it was written from", async () => {
    const { book, lines } = bookAt(ADVANCED);
    const zipPath = resolve(scratchDir("se-saved-zip-"), saved.filename);
    writeFileSync(zipPath, Buffer.from(saved.zip));

    const reimported = await extractBookFromFile(zipPath, { product: "se" });

    expect(reimported.product).toBe("se");
    expect(reimported.lines.length, "no transaction line is dropped or duplicated").toBe(lines.length);

    const asPosted = (entries) => entries.map((line) => [line.sourceJournalID, line.postingDate, line.amount].join("|")).sort();
    expect(asPosted(reimported.lines)).toEqual(asPosted(lines));
    const asDay = (value) => new Date(value).toISOString().slice(0, 10);
    expect(asDay(reimported.book.documentInfo.periodCoveredEnd)).toBe(asDay(book.documentInfo.periodCoveredEnd));
  }, 600000);

  it("agrees with the engine on every cell the writer filled", async () => {
    const { book, lines } = bookAt(ADVANCED);

    const reportBin = resolve(ROOT, "app/bin/report.js");
    const fromPackage = scratchDir("se-report-saved-");
    const fromBook = scratchDir("se-report-data-");
    execFileSync(NODE, [reportBin, "--package", "se", "--source-dir", packageDir, "--mode", "saved", "--output-dir", fromPackage], {
      cwd: ROOT,
      encoding: "utf8",
    });
    execFileSync(NODE, [reportBin, "--package", "se", "--data", ADVANCED, "--years", "se-2025-2026", "--output-dir", fromBook], {
      cwd: ROOT,
      encoding: "utf8",
    });

    // The cells the writer itself fills. Every other cell of a saved package
    // is a formula the spreadsheet app has yet to recalculate, so the two
    // reports are only comparable on the writer's own inputs.
    const writes = cellWrites(diyaGlToScenario(book, lines, "se"), targetStartYearOf(book));
    const writerInputs = new Set();
    for (const [file, sheets] of Object.entries(writes)) {
      for (const [sheet, cells] of Object.entries(sheets)) {
        for (const cell of Object.keys(cells)) writerInputs.add(`cell/${file}!${sheet}!${cell}`);
      }
    }

    const valuesIn = (dir) => JSON.parse(readFileSync(resolve(dir, "report.json"), "utf8")).values;
    const fromPackageValues = valuesIn(fromPackage).filter((value) => writerInputs.has(value.key));
    const byKey = new Map(valuesIn(fromBook).map((value) => [value.key, value.value]));

    expect(fromPackageValues.length).toBeGreaterThan(0);
    for (const value of fromPackageValues) {
      expect(byKey.has(value.key), `${value.key} is in the package's report and not the book's`).toBe(true);
      expect(value.value, `${value.key} differs between the saved package and the book`).toEqual(byKey.get(value.key));
    }
  }, 600000);
});
