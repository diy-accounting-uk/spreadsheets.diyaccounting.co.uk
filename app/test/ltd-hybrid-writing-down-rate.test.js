// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The main writing down rate of a Company accounting period that holds the day
// the rate changed. GOV.UK says to work out a hybrid rate for that period:
// https://www.gov.uk/guidance/calculate-your-hybrid-rate-of-writing-down-allowance
// The days before the change over the days in the period times the earlier
// rate, plus the days from the change over the days in the period times the
// later rate, rounded up to 2 decimal places. The generator, the loader and the
// calculator take the rate from one function, so the workbook and the
// calculator agree.
//
// The recalculation case requires LibreOffice (brew install --cask libreoffice)

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateLtdCells } from "../lib/calculators/ltd.js";
import { parseDiyaGlData } from "../lib/diya-gl-loader.js";
import { mainWritingDownPercent, mainWritingDownPercentForYearEnd } from "../lib/tax/capital-allowances.js";
import { buildLtdCellEdits, fromExcelSerial, toExcelSerial } from "../lib/generator.js";
import { resolveInputs, saveWorkbookFiles } from "../lib/product-workbook.js";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { standardReads as ltdReads, multiFileOptions as ltdMultiFileOptions } from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const DATA_DIR = resolve(ROOT, "app", "data");
const EXAMPLE = resolve(ROOT, "examples", "brickwork-pro", "ltd-nonvat");

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const yearFiles = readdirSync(DATA_DIR)
  .filter((name) => /^ltd-\d{4}\.toml$/.test(name))
  .sort();
const taxDataOf = (name) => parseTOML(readFileSync(resolve(DATA_DIR, name), "utf8"));
const day = (iso) => new Date(`${iso}T00:00:00Z`);

describe("The hybrid main writing down rate", () => {
  const data2026 = taxDataOf("ltd-2026.toml");

  it("gives 14.99 for the GOV.UK worked example, 1 January to 31 December 2026", () => {
    expect(mainWritingDownPercent(data2026, day("2026-01-01"), day("2026-12-31"))).toBe(14.99);
  });

  it("gives 17.01 for a year to 30 June 2026", () => {
    expect(mainWritingDownPercentForYearEnd(data2026, day("2026-06-30"))).toBe(17.01);
  });

  it("gives the later rate for a period that starts on the day the rate changed", () => {
    expect(mainWritingDownPercentForYearEnd(data2026, day("2027-03-31"))).toBe(14);
  });

  it("gives the earlier rate for a period that ends the day before the rate changed", () => {
    expect(mainWritingDownPercentForYearEnd(taxDataOf("ltd-2025.toml"), day("2026-03-31"))).toBe(18);
  });

  it("gives the rate itself when both years charge the same", () => {
    expect(mainWritingDownPercentForYearEnd(taxDataOf("ltd-2027.toml"), day("2027-06-30"))).toBe(14);
    expect(mainWritingDownPercentForYearEnd(taxDataOf("ltd-2024.toml"), day("2024-09-30"))).toBe(18);
  });

  it("refuses a period that reaches back over 1 April when the file states no earlier rate", () => {
    const bare = structuredClone(data2026);
    delete bare.capital_allowances_previous_financial_year;
    expect(() => mainWritingDownPercentForYearEnd(bare, day("2026-06-30"))).toThrow(/capital_allowances_previous_financial_year/);
  });

  it("is the figure the generator writes to Admin G6 and G8", () => {
    const { numericEdits } = buildLtdCellEdits(data2026, toExcelSerial(day("2026-06-30")));
    expect(numericEdits.G6).toBe(17.01);
    expect(numericEdits.G8).toBe(17.01);
  });
});

describe("The year files", () => {
  it("state the earlier rate that the year file before them states as its own", () => {
    for (let index = 1; index < yearFiles.length; index++) {
      const earlier = taxDataOf(yearFiles[index - 1]).capital_allowances.writing_down_allowance_main;
      const stated = taxDataOf(yearFiles[index]).capital_allowances_previous_financial_year.writing_down_allowance_main;
      expect(stated, yearFiles[index]).toBe(earlier);
    }
  });

  it("state a special rate of 6%, so no hybrid arises on it", () => {
    for (const name of yearFiles) expect(taxDataOf(name).capital_allowances.writing_down_allowance_special, name).toBe(0.06);
  });
});

// A year to 30 June 2026 with one main pool asset brought forward, as the
// calculator reads it and as the generated package reads it after LibreOffice
// recalculates it.
describeCalc("A year to 30 June 2026 with a main pool asset brought forward", () => {
  const OPENING_ASSET = [
    "[[fixedAssets]]",
    'assetID = "FA-PLANT-OLD"',
    'class = "plantMachinery"',
    'description = "Brick saw"',
    "cost = 15000.00",
    "accumulatedDepreciation = 5000.00",
    "taxWrittenDownValue = 10000.00",
    "acquiredDate = 2023-01-01",
    "",
    "",
  ].join("\n");

  it("claims the hybrid rate in the workbook and in the calculator, to the pound", async () => {
    const bookToml = readFileSync(resolve(EXAMPLE, "book.toml"), "utf8").replace("[[members]]", `${OPENING_ASSET}[[members]]`);
    const { book, lines } = parseDiyaGlData(bookToml, readFileSync(resolve(EXAMPLE, "lines.jsonl"), "utf8"), "+P3M");
    const { taxData, scenario } = await resolveInputs(book, lines);
    expect(taxData.financial_year.label).toBe("FY2026");
    const calculated = calculateLtdCells(book, lines, taxData, scenario);

    const files = (await saveWorkbookFiles(book, lines)).files;
    const buffers = Object.fromEntries(files.map((file) => [file.name, Buffer.from(file.bytes)]));
    const reads = ltdReads();
    reads.CorporationTax = [...new Set([...(reads.CorporationTax || []), "G16", "G17", "F93", "I17", "K20"])];
    const options = ltdMultiFileOptions(6);
    options.additionalReads["Fixedassets.xlsx"].Schedule = ["E14", "R14", "R4", "R22"];
    const workbook = await runMultiFileSpreadsheet(buffers, {}, reads, "Financialaccounts.xlsx", options);

    const sheet = workbook["Fixedassets.xlsx!Schedule"];
    expect(workbook.Admin.G6).toBe(17.01);
    expect(workbook.Admin.G8).toBe(17.01);
    expect(sheet.R4).toBe(17.01);
    expect(sheet.R14).toBeCloseTo(1701, 6);
    expect(calculated.Admin.G6).toBe(17.01);
    expect(Math.round(calculated["Fixedassets.xlsx!Schedule"].R22)).toBe(Math.round(sheet.R22));
    expect(Math.round(calculated.CorporationTax.I17)).toBe(Math.round(workbook.CorporationTax.I17));
    expect(Math.round(calculated.CorporationTax.K20)).toBe(Math.round(workbook.CorporationTax.K20));
    expect(workbook.CorporationTax.F93).toBeCloseTo(0.1701, 6);
    expect(fromExcelSerial(calculated.Admin.F21).toISOString().slice(0, 10)).toBe("2026-06-30");
  }, 1500000);
});
