// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

import { saveWorkbook, savePackageZip, taxYearFileName } from "../lib/product-workbook.js";
import { generateSpreadsheet, packageNaming } from "../lib/generator.js";
import { applyCellWrites, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { cellWrites, TaxiDateOffGridError } from "../products/taxi.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");

const FIXTURES = [
  ["basic-taxi-driver", "examples/basic-taxi-driver/taxi"],
  ["sp-sixty-driving", "examples/sp-sixty-driving/taxi"],
  ["kestrel-executive-cars", "examples/kestrel-executive-cars/taxi"],
];

// The steps the CLI ran before there was a save function: generate the year's
// workbook from the template, then write the scenario's cells into it. No
// target year is passed -- the Taxi writer takes its grid from the scenario's
// own dates, matching saveWorkbook's own call.
async function workbookTheGeneratePathComposes(book, lines) {
  const productMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates/taxi/meta.toml"), "utf8"));
  const sharedMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates/meta.toml"), "utf8"));
  const taxData = parseTOML(
    readFileSync(resolve(APP_DIR, `data/${taxYearFileName(new Date(book.documentInfo.periodCoveredEnd))}.toml`), "utf8"),
  );

  const templateBuffer = readFileSync(resolve(APP_DIR, "templates/taxi", productMeta.template.spreadsheet));
  const generated = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
  const workbook = await applyCellWrites(generated, cellWrites(diyaGlToScenario(book, lines, "taxi")));

  const { xlsxFilename } = packageNaming(productMeta, sharedMeta, new Date(taxData.tax_year.end));
  return { workbook, filename: xlsxFilename };
}

async function readCell(workbook, sheetName, cellRef) {
  const zip = await JSZip.loadAsync(workbook);
  const sheetPath = (await buildSheetMap(zip)).get(sheetName);
  const sharedStrings = await loadSharedStrings(zip);
  return readCellValue(await zip.file(sheetPath).async("string"), cellRef, sharedStrings);
}

describe("saveWorkbook on a Taxi book", () => {
  for (const [name, dir] of FIXTURES) {
    it(`writes ${name} to the same bytes the generate path composes`, async () => {
      const { book, lines } = loadDiyaGlData(resolve(ROOT, dir));

      const carved = await saveWorkbook(book, lines);
      const composed = await workbookTheGeneratePathComposes(book, lines);

      expect(carved.filename).toBe(composed.filename);
      expect(Buffer.compare(carved.workbook, composed.workbook)).toBe(0);
    }, 120000);
  }

  it("names the workbook for the tax year the book's period ends in", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/basic-taxi-driver/taxi"));
    const { filename } = await saveWorkbook(book, lines);
    expect(filename).toBe("Financialaccountsyearto050426.xlsx");
  }, 120000);

  it("puts the book's own year on the Sales grid: SalesMay!A5 is the year's own 1 May", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/basic-taxi-driver/taxi"));
    const { workbook } = await saveWorkbook(book, lines);
    expect(await readCell(workbook, "SalesMay", "A5")).toBe(45775);
  }, 120000);

  it("asks the spreadsheet app to recalculate on open", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/sp-sixty-driving/taxi"));
    const { workbook } = await saveWorkbook(book, lines);
    const zip = await JSZip.loadAsync(workbook);
    expect(await zip.file("xl/workbook.xml").async("string")).toContain('fullCalcOnLoad="1"');
  }, 120000);
});

describe("a Taxi book with a fare dated outside the package's year", () => {
  it("rejects with TaxiDateOffGridError naming the date, and writes nothing", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/basic-taxi-driver/taxi"));
    const offGridLine = {
      // Sorts after every TXN-* entry so the sort diyaGlToScenario applies
      // for Taxi leaves the book's own earliest fare first; extractTaxYearStart
      // (scenario-loader.js) reads the tax year off whichever transaction that
      // sort puts first, so this line must not become it.
      entryNumber: "ZZZ-TEST-OFFGRID-1",
      sourceJournalID: "sales",
      postingDate: "2026-04-07",
      accountMainID: "4000",
      amount: 50,
      documentType: "receipt",
      detailComment: "Daily fares",
      lineItemComment: "Gross fares taken",
      taxCode: "OS",
      taxRate: 0,
      paymentMethod: "cash",
    };

    await expect(saveWorkbook(book, [...lines, offGridLine])).rejects.toThrow(TaxiDateOffGridError);
    await expect(saveWorkbook(book, [...lines, offGridLine])).rejects.toThrow("2026-04-07");
  }, 120000);
});

describe("savePackageZip on a Taxi book", () => {
  it("names and wraps the workbook the same way saveWorkbook does", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/basic-taxi-driver/taxi"));

    const { zip: zipBuffer, filename } = await savePackageZip(book, lines);
    expect(filename).toBe("GB Accounts Taxi Driver 2026-04-05 (Apr26) Excel 2007.zip");

    const zip = await JSZip.loadAsync(zipBuffer);
    expect(Object.keys(zip.files)).toEqual(["Financialaccountsyearto050426.xlsx"]);

    const held = await zip.file("Financialaccountsyearto050426.xlsx").async("nodebuffer");
    const { workbook } = await saveWorkbook(book, lines);
    expect(Buffer.compare(held, workbook)).toBe(0);
  }, 180000);
});
