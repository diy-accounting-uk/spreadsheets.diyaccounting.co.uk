// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// A car in a Company book. A car does not qualify for the annual investment
// allowance (https://www.gov.uk/capital-allowances/business-cars), so the
// Fixed Assets schedule claims it on the Cars rows: the main writing down
// rate on the cost of a car bought in the year (rows 97 to 101) and on the tax
// written-down value of a car already owned (rows 44 to 48). A van, a lorry, a
// motorcycle and a hackney carriage are not cars and keep the plant rows.
//
// The recalculation case requires LibreOffice (brew install --cask libreoffice)

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateLtdCells } from "../lib/calculators/ltd.js";
import { parseDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { cellWrites as ltdCellWrites, standardReads as ltdReads, multiFileOptions as ltdMultiFileOptions } from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(ROOT, "app");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const EXAMPLE = resolve(ROOT, "examples", "brickwork-pro", "ltd-nonvat");

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "ltd-2026.toml"), "utf8"));
const MAIN_RATE_PERCENT = Math.round(taxData.capital_allowances.writing_down_allowance_main * 100);

const VAN_ENTRY = 'class = "motorVehicles"\ndescription = "Ford Transit Custom van"\ncost = 12000.00';
const VAN_LINE =
  '"amount":12000.00,"documentType":"invoice","documentReference":"PUR-FA-001","detailComment":"Ford Dealer","lineItemComment":"Ford Transit Custom van"';
const CAR_ENTRY = 'class = "motorVehicles"\ncar = true\ndescription = "Petrol car"\ncost = 20000.00';
const CAR_LINE =
  '"amount":20000.00,"documentType":"invoice","documentReference":"PUR-FA-001","detailComment":"Ford Dealer","lineItemComment":"Petrol car"';

const exampleBook = readFileSync(resolve(EXAMPLE, "book.toml"), "utf8");
const exampleLines = readFileSync(resolve(EXAMPLE, "lines.jsonl"), "utf8");

// The example company bought a £12,000 van in the year. These books swap it
// for a £20,000 car, or leave it as the van.
function bookWith({ bookToml = exampleBook, linesJsonl = exampleLines } = {}) {
  const { book, lines } = parseDiyaGlData(bookToml, linesJsonl);
  const scenario = diyaGlToScenario(book, lines, "ltd");
  return { book, lines, scenario, results: calculateLtdCells(book, lines, taxData, scenario) };
}

function carBook() {
  expect(exampleBook).toContain(VAN_ENTRY);
  expect(exampleLines).toContain(VAN_LINE);
  return bookWith({ bookToml: exampleBook.replace(VAN_ENTRY, CAR_ENTRY), linesJsonl: exampleLines.replace(VAN_LINE, CAR_LINE) });
}

describe("A car bought in the year", () => {
  const car = carBook();
  const schedule = car.results["Fixedassets.xlsx!Schedule"];
  const tax = car.results.CorporationTax;

  it("is marked on the purchase the Schedule writer and the calculator both read", () => {
    const purchases = Object.values(car.scenario.purchases)
      .flat()
      .filter((transaction) => transaction.code === "fa");
    expect(purchases.map((transaction) => transaction.asset_class)).toEqual(["car"]);
  });

  it("claims the main rate on its cost, on the first Cars row", () => {
    expect(schedule.E97).toBe(20000);
    expect(schedule.R97).toBeCloseTo((20000 * MAIN_RATE_PERCENT) / 100, 6);
  });

  it("claims no annual investment allowance", () => {
    expect(tax.I15).toBe(0);
    expect(tax.I16).toBeCloseTo((20000 * MAIN_RATE_PERCENT) / 100, 6);
  });

  it("leaves the Cars rows with no asset on them blank", () => {
    for (const row of [98, 99, 100, 101]) expect(schedule[`R${row}`]).toBe(" ");
  });

  it("states the same allowance as the Corporation Tax deduction less what the other assets claim", () => {
    expect(tax.K20).toBeCloseTo(tax.I15 + tax.I16 + tax.I17 + tax.I18, 6);
  });
});

describe("A van bought in the year", () => {
  const van = bookWith();
  const tax = van.results.CorporationTax;

  it("is not marked as a car", () => {
    const purchases = Object.values(van.scenario.purchases)
      .flat()
      .filter((transaction) => transaction.code === "fa");
    expect(purchases.map((transaction) => transaction.asset_class)).toEqual([undefined]);
  });

  it("keeps the annual investment allowance on its whole cost", () => {
    expect(tax.I15).toBe(12000);
    expect(tax.I16).toBe(0);
    expect(van.results["Fixedassets.xlsx!Schedule"].Q67).toBe(12000);
  });
});

describe("A car already owned", () => {
  const OLD_CAR = [
    "[[fixedAssets]]",
    'assetID = "FA-CAR-OLD"',
    'class = "motorVehicles"',
    "car = true",
    'description = "Estate car"',
    "cost = 15000.00",
    "accumulatedDepreciation = 5000.00",
    "taxWrittenDownValue = 8000.00",
    "acquiredDate = 2023-01-01",
    "",
    "",
  ].join("\n");
  const owned = bookWith({ bookToml: exampleBook.replace("[[members]]", `${OLD_CAR}[[members]]`) });

  it("goes on the Cars rows of the existing block", () => {
    expect(owned.scenario.opening_fixed_assets.filter((asset) => asset.car).map((asset) => asset.category)).toEqual(["motor"]);
  });

  it("claims the main rate on its tax written-down value", () => {
    const schedule = owned.results["Fixedassets.xlsx!Schedule"];
    expect(schedule.R55).toBeCloseTo((8000 * MAIN_RATE_PERCENT) / 100, 6);
    expect(owned.results.CorporationTax.I17).toBeCloseTo((8000 * MAIN_RATE_PERCENT) / 100, 6);
  });
});

describe("A car in a book", () => {
  it("is refused when its class is not motor vehicles", () => {
    const wrongClass = CAR_ENTRY.replace('class = "motorVehicles"', 'class = "plantMachinery"');
    expect(() =>
      bookWith({ bookToml: exampleBook.replace(VAN_ENTRY, wrongClass), linesJsonl: exampleLines.replace(VAN_LINE, CAR_LINE) }),
    ).toThrow(/is a car, so its class is motorVehicles/);
  });
});

// The same book, once as the calculator reads it and once as a Company package
// reads it after LibreOffice recalculates it: the figures on the Cars row, and
// the Corporation Tax deduction they feed, agree to the pound.
describeCalc("A car on Fixedassets row 97, calculated and recalculated", () => {
  it("gives the same writing down allowance and the same Corporation Tax deduction", async () => {
    const { scenario, results } = carBook();
    const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
    const fileBuffers = {};
    for (const templateFile of productMeta.template.files) {
      const buffer = readFileSync(resolve(LTD_DIR, templateFile));
      const sheetsConfig = productMeta.sheets?.[templateFile.replace(".xlsx", "").replace(".docx", "").toLowerCase()];
      fileBuffers[templateFile] =
        sheetsConfig && Object.keys(sheetsConfig).length > 0 ? await generateSpreadsheet(buffer, taxData, sheetsConfig) : buffer;
    }

    const writes = ltdCellWrites(scenario, 2026, 3);
    expect(Object.keys(writes["Fixedassets.xlsx"].Schedule).sort()).toEqual(["B97", "C97", "E97"]);

    const reads = ltdReads();
    reads.CorporationTax = [...new Set([...(reads.CorporationTax || []), "I15", "I16", "K91", "K20"])];
    const options = ltdMultiFileOptions(3);
    options.additionalReads["Fixedassets.xlsx"].Schedule = ["E97", "R97", "S97", "R4"];
    const workbook = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx", options);

    const sheet = workbook["Fixedassets.xlsx!Schedule"];
    const calculated = results["Fixedassets.xlsx!Schedule"];
    const sheetTax = workbook.CorporationTax;
    const calculatedTax = results.CorporationTax;

    expect(sheet.R4).toBe(MAIN_RATE_PERCENT);
    expect(sheet.R97).toBe(2800);
    expect(Math.round(calculated.R97)).toBe(Math.round(sheet.R97));
    expect(Math.round(calculatedTax.I16)).toBe(Math.round(sheetTax.K91));
    expect(Math.round(calculatedTax.I16)).toBe(Math.round(sheetTax.I16));
    expect(Math.round(calculatedTax.I15)).toBe(Math.round(sheetTax.I15));
    expect(Math.round(calculatedTax.K20)).toBe(Math.round(sheetTax.K20));
  }, 1500000);
});
