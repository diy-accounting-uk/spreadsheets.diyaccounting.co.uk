// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// A car, and a purpose-built taxi, in an Income Tax book. A car does not
// qualify for the annual investment allowance
// (https://www.gov.uk/capital-allowances/business-cars), so a book that states
// an asset is a car puts it on the workbook's Cars rows, which claim the main
// writing down rate on the cost less the private use share: rows 97 to 101 of
// the Self Employed Schedule and of the Basic Sole Trader Fixed Assets sheet.
// The Taxi Driver workbook claims the main rate on every vehicle already. A
// purpose-built taxi (a hackney carriage) is not a car, so a Taxi book that
// states one puts it on the plant block, rows 36 to 43, which claims the whole
// cost. A book that states neither is written as it always was.
//
// The recalculation cases require LibreOffice (brew install --cask libreoffice)

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { parseDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { runSpreadsheet, runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { calculateSeCells } from "../lib/calculators/se.js";
import { calculateBstResults } from "../lib/calculators/bst.js";
import { calculateTaxiResults } from "../lib/calculators/taxi.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seMultiFileOptions,
  writerSkips as seWriterSkips,
} from "../products/se.js";
import { cellWrites as bstCellWrites, standardReads as bstReads } from "../products/bst.js";
import { cellWrites as taxiCellWrites, standardReads as taxiReads } from "../products/taxi.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(ROOT, "app");

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));
const MAIN_RATE = taxData.capital_allowances.writing_down_allowance;
const AIA_RATE = taxData.capital_allowances.annual_investment_allowance;
const TAX_YEAR_START = new Date(taxData.tax_year.start).getUTCFullYear();

const example = (dir) => ({
  book: readFileSync(resolve(ROOT, "examples", dir, "book.toml"), "utf8"),
  lines: readFileSync(resolve(ROOT, "examples", dir, "lines.jsonl"), "utf8"),
});

const VAN_ENTRY = 'class = "motorVehicles"\ndescription = "Ford Transit Custom van"\ncost = 12000.00';
const VAN_LINE =
  '"amount":12000.00,"documentType":"invoice","documentReference":"PUR-FA-001","detailComment":"Ford Dealer","lineItemComment":"Ford Transit Custom van"';
const CAR_ENTRY = 'class = "motorVehicles"\ncar = true\ndescription = "Petrol car"\ncost = 20000.00';
const CAR_LINE =
  '"amount":20000.00,"documentType":"invoice","documentReference":"PUR-FA-001","detailComment":"Ford Dealer","lineItemComment":"Petrol car"';

const TAXI_ENTRY = 'assetID = "FA-VEHICLE-001"\ndescription = "Taxi vehicle"\ncost = 8000.00';

function swapped(files, from, to, lineFrom, lineTo) {
  expect(files.book).toContain(from);
  expect(files.lines).toContain(lineFrom);
  return { book: files.book.replace(from, to), lines: files.lines.replace(lineFrom, lineTo) };
}

const seExample = example("brickwork-pro/se-nonvat");
const bstExample = example("brickwork-pro/bst-nonvat");
const taxiExample = example("basic-taxi-driver/taxi");
const seCarFiles = swapped(seExample, VAN_ENTRY, CAR_ENTRY, VAN_LINE, CAR_LINE);
const bstCarFiles = swapped(bstExample, VAN_ENTRY, CAR_ENTRY, VAN_LINE, CAR_LINE);
const taxiPlantFiles = {
  book: taxiExample.book.replace(TAXI_ENTRY, `${TAXI_ENTRY}\npurposeBuiltTaxi = true`),
  lines: taxiExample.lines,
};

function parsed(files, product) {
  const { book, lines } = parseDiyaGlData(files.book, files.lines);
  const scenario = diyaGlToScenario(book, lines, product);
  return { book, lines, scenario };
}

const near = (value) => Math.round(value);

describe("A Self Employed car bought in the year", () => {
  const { book, lines, scenario } = parsed(seCarFiles, "se");
  const cells = calculateSeCells(book, lines, taxData, scenario);
  const schedule = cells["Fixedassets.xlsx!Schedule"];

  it("is marked on the purchase the Schedule writer and the calculator both read", () => {
    const purchases = Object.values(scenario.purchases)
      .flat()
      .filter((transaction) => transaction.code === "fa");
    expect(purchases.map((transaction) => transaction.asset_class)).toEqual(["car"]);
  });

  it("is written to the first Cars row and no Plant row", () => {
    const written = seCellWrites(scenario, TAX_YEAR_START)["Fixedassets.xlsx"].Schedule;
    expect(written.E97).toBe(20000);
    for (const row of [67, 68, 69, 70, 71]) expect(written[`E${row}`]).toBeUndefined();
  });

  it("claims the main rate on its cost and no annual investment allowance", () => {
    expect(schedule.E97).toBe(20000);
    expect(schedule.R97).toBeCloseTo(20000 * MAIN_RATE, 6);
    expect(schedule.S97).toBeCloseTo(20000 * (1 - MAIN_RATE), 6);
    expect(schedule.Q1).toBe(0);
    expect(cells["SE Short"].D80).toBe(0);
  });
});

describe("A Self Employed van bought in the year", () => {
  const { book, lines, scenario } = parsed(seExample, "se");
  const cells = calculateSeCells(book, lines, taxData, scenario);

  it("keeps the Plant row and the annual investment allowance on its whole cost", () => {
    expect(seCellWrites(scenario, TAX_YEAR_START)["Fixedassets.xlsx"].Schedule.E67).toBe(12000);
    expect(cells["Fixedassets.xlsx!Schedule"].Q1).toBe(12000 * AIA_RATE);
    expect(cells["Fixedassets.xlsx!Schedule"].E97).toBeUndefined();
  });
});

describe("A Self Employed car with a private use share", () => {
  const privateEntry = `${CAR_ENTRY}\nsingleAssetPool = true\nprivateUseProportion = 0.25`;
  const files = swapped(seExample, VAN_ENTRY, privateEntry, VAN_LINE, CAR_LINE);
  const { book, lines, scenario } = parsed(files, "se");
  const cells = calculateSeCells(book, lines, taxData, scenario);

  it("claims the main rate on the business share, in its own pool", () => {
    const written = seCellWrites(scenario, TAX_YEAR_START)["Fixedassets.xlsx"].Schedule;
    expect(written.M97).toBe(0.25);
    expect(written.AD97).toBe("P");
    expect(cells["Fixedassets.xlsx!Schedule"].R97).toBeCloseTo(20000 * MAIN_RATE * 0.75, 6);
  });

  it("is refused without the single asset pool", () => {
    const refused = swapped(seExample, VAN_ENTRY, `${CAR_ENTRY}\nprivateUseProportion = 0.25`, VAN_LINE, CAR_LINE);
    expect(() => parsed(refused, "se")).toThrow(/privateUseProportion without singleAssetPool/);
  });
});

describe("A Self Employed book with more cars than Cars rows", () => {
  it("names each purchase the Schedule has no row for", () => {
    const { scenario } = parsed(seCarFiles, "se");
    const [purchase] = Object.values(scenario.purchases)
      .flat()
      .filter((transaction) => transaction.code === "fa");
    const crowded = { ...scenario, purchases: { apr: Array.from({ length: 6 }, () => ({ ...purchase })) } };
    expect(seWriterSkips(crowded, TAX_YEAR_START).filter((skip) => skip.kind === "assetPurchase")).toHaveLength(1);
  });
});

describe("A Basic Sole Trader car bought in the year", () => {
  const { book, lines, scenario } = parsed(bstCarFiles, "bst");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateBstResults(book, lines, taxData, merged);
  const sheet = results["Fixed Assets"];

  it("is written to the first Cars row and no Plant row", () => {
    const written = bstCellWrites(scenario, TAX_YEAR_START)["Fixed Assets"];
    expect(written.E97).toBe(20000);
    expect(written.E67).toBeUndefined();
  });

  it("claims the main rate on its cost and no annual investment allowance", () => {
    expect(sheet.E97).toBe(20000);
    expect(sheet.L97).toBeCloseTo(20000 * MAIN_RATE, 6);
    expect(sheet.L1).toBeCloseTo(20000 * MAIN_RATE, 6);
    expect(sheet.K1).toBe(0);
    expect(sheet.E67).toBeUndefined();
  });

  it("claims the main rate on the business share when the book states private use", () => {
    const withPrivateUse = swapped(bstExample, VAN_ENTRY, `${CAR_ENTRY}\nprivateUseProportion = 0.25`, VAN_LINE, CAR_LINE);
    const privateBook = parsed(withPrivateUse, "bst");
    const privateSheet = calculateBstResults(privateBook.book, privateBook.lines, taxData, {
      ...privateBook.scenario,
      ...privateBook.scenario.expected,
    })["Fixed Assets"];
    expect(bstCellWrites(privateBook.scenario, TAX_YEAR_START)["Fixed Assets"].G97).toBe(0.25);
    expect(privateSheet.L97).toBeCloseTo(20000 * MAIN_RATE * 0.75, 6);
  });
});

describe("A Basic Sole Trader van bought in the year", () => {
  it("keeps the Plant row and the annual investment allowance on its whole cost", () => {
    const { book, lines, scenario } = parsed(bstExample, "bst");
    const sheet = calculateBstResults(book, lines, taxData, { ...scenario, ...scenario.expected })["Fixed Assets"];
    expect(bstCellWrites(scenario, TAX_YEAR_START)["Fixed Assets"].E67).toBe(12000);
    expect(sheet.K1).toBe(12000 * AIA_RATE);
    expect(sheet.E97).toBeUndefined();
  });
});

describe("A Taxi Driver purpose-built taxi bought in the year", () => {
  const { book, lines, scenario } = parsed(taxiPlantFiles, "taxi");
  const results = calculateTaxiResults(book, lines, taxData, { ...scenario, ...scenario.expected });
  const sheet = results["Fixed Assets"];

  it("is written to the first plant row and no vehicles row", () => {
    const written = taxiCellWrites(scenario, TAX_YEAR_START)["Fixed Assets"];
    expect(written.D36).toBe(8000);
    expect(written.D47).toBeUndefined();
  });

  it("claims the annual investment allowance on its whole cost", () => {
    expect(sheet.D36).toBe(8000);
    expect(sheet.I1).toBe(8000 * AIA_RATE);
    expect(sheet.J1).toBe(0);
    expect(sheet.K1).toBe(8000 - 8000 * AIA_RATE);
  });

  it("is refused in any other product", () => {
    expect(() => parsed(taxiPlantFiles, "bst")).toThrow(/only the Taxi Driver workbook has a plant block/);
  });
});

describe("A Taxi Driver vehicle that the book does not state is a purpose-built taxi", () => {
  it("keeps the vehicles row and the main rate", () => {
    const { book, lines, scenario } = parsed(taxiExample, "taxi");
    const sheet = calculateTaxiResults(book, lines, taxData, { ...scenario, ...scenario.expected })["Fixed Assets"];
    expect(taxiCellWrites(scenario, TAX_YEAR_START)["Fixed Assets"].D47).toBe(8000);
    expect(sheet.D36).toBeUndefined();
    expect(sheet.I1).toBe(0);
    expect(sheet.J1).toBeCloseTo(8000 * MAIN_RATE, 6);
  });
});

describe("A fixed asset stated as a car and as a purpose-built taxi", () => {
  it("is refused", () => {
    const both = {
      book: taxiExample.book.replace(TAXI_ENTRY, `${TAXI_ENTRY}\ncar = true\npurposeBuiltTaxi = true`),
      lines: taxiExample.lines,
    };
    expect(() => parsed(both, "taxi")).toThrow(/both a car and a purpose-built taxi/);
  });

  it("is refused as a car in a class other than motor vehicles", () => {
    const wrongClass = swapped(seExample, VAN_ENTRY, CAR_ENTRY.replace("motorVehicles", "plantMachinery"), VAN_LINE, CAR_LINE);
    expect(() => parsed(wrongClass, "se")).toThrow(/is a car, so its class is motorVehicles/);
  });
});

// The same book, once as the calculator reads it and once as a generated
// package reads it after LibreOffice recalculates it: the claim cell and the
// tax computation cells that read it agree to the pound.
function expectSameCells(sheets, calculated, pairs) {
  for (const [sheet, cell] of pairs) {
    expect(near(calculated[sheet][cell]), `${sheet}!${cell}`).toBe(near(sheets[sheet][cell]));
  }
}

describeCalc("A Self Employed car on Fixedassets row 97, calculated and recalculated", () => {
  it("gives the same writing down allowance and the same tax computation", async () => {
    const { book, lines, scenario } = parsed(seCarFiles, "se");
    const calculated = calculateSeCells(book, lines, taxData, scenario);
    const SE_DIR = resolve(APP_DIR, "templates", "se");
    const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));
    const fileBuffers = {};
    for (const templateFile of productMeta.template.files) {
      const buffer = readFileSync(resolve(SE_DIR, templateFile));
      const sheetsConfig = productMeta.sheets?.[templateFile.replace(".xlsx", "").toLowerCase()];
      fileBuffers[templateFile] =
        sheetsConfig && Object.keys(sheetsConfig).length > 0 ? await generateSpreadsheet(buffer, taxData, sheetsConfig) : buffer;
    }
    const reads = seReads();
    const options = seMultiFileOptions();
    const scheduleCells = ["E97", "R97", "S97", "R1", "S1", "Q1"];
    options.additionalReads["Fixedassets.xlsx"].Schedule = [
      ...new Set([...options.additionalReads["Fixedassets.xlsx"].Schedule, ...scheduleCells]),
    ];
    reads["SE Short"] = [...new Set([...(reads["SE Short"] || []), "D80", "O80", "D85", "D99", "D106"])];
    reads["SE Full"] = [...new Set([...(reads["SE Full"] || []), "D139", "D144"])];

    const workbook = await runMultiFileSpreadsheet(
      fileBuffers,
      seCellWrites(scenario, TAX_YEAR_START),
      reads,
      "Financialaccounts.xlsx",
      options,
    );

    expect(workbook["Fixedassets.xlsx!Schedule"].R97).toBe(20000 * MAIN_RATE);
    expect(workbook["Fixedassets.xlsx!Schedule"].Q1 || 0).toBe(0);
    const schedule = "Fixedassets.xlsx!Schedule";
    expectSameCells(workbook, calculated, [
      ...scheduleCells.map((cell) => [schedule, cell]),
      ["SE Short", "D80"],
      ["SE Short", "O80"],
      ["SE Short", "D99"],
      ["SE Short", "D106"],
      ["SE Full", "D139"],
      ["SE Full", "D144"],
    ]);
  }, 1500000);
});

describeCalc("A Basic Sole Trader car on Fixed Assets row 97, calculated and recalculated", () => {
  it("gives the same writing down allowance and the same tax computation", async () => {
    const { book, lines, scenario } = parsed(bstCarFiles, "bst");
    const calculated = calculateBstResults(book, lines, taxData, { ...scenario, ...scenario.expected });
    const BST_DIR = resolve(APP_DIR, "templates", "bst");
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    const generated = await generateSpreadsheet(readFileSync(resolve(BST_DIR, "bst-excel.xlsx")), taxData, productMeta.sheets);
    const reads = bstReads();
    reads["Fixed Assets"] = [...new Set([...(reads["Fixed Assets"] || []), "E97", "L97", "M97", "L1", "K1", "M1"])];
    reads["SE Short"] = [...new Set([...(reads["SE Short"] || []), "D80", "O80", "D85", "D99", "D106"])];
    const sheets = await runSpreadsheet(generated, bstCellWrites(scenario, TAX_YEAR_START), reads);

    expect(sheets["Fixed Assets"].L97).toBe(20000 * MAIN_RATE);
    expectSameCells(sheets, calculated, [
      ["Fixed Assets", "E97"],
      ["Fixed Assets", "L97"],
      ["Fixed Assets", "M97"],
      ["Fixed Assets", "L1"],
      ["Fixed Assets", "K1"],
      ["Fixed Assets", "M1"],
      ["SE Short", "D80"],
      ["SE Short", "O80"],
      ["SE Short", "D85"],
      ["SE Short", "D99"],
      ["SE Short", "D106"],
      ["Profit & Loss Acc", "C26"],
      ["Profit & Loss Acc", "C28"],
    ]);
  }, 600000);
});

describeCalc("A Taxi Driver purpose-built taxi on Fixed Assets row 36, calculated and recalculated", () => {
  it("gives the same annual investment allowance and the same tax computation", async () => {
    const { book, lines, scenario } = parsed(taxiPlantFiles, "taxi");
    const calculated = calculateTaxiResults(book, lines, taxData, { ...scenario, ...scenario.expected });
    const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    const generated = await generateSpreadsheet(readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx")), taxData, productMeta.sheets);
    const reads = taxiReads();
    reads["Fixed Assets"] = [...new Set([...(reads["Fixed Assets"] || []), "D36", "I36", "K36", "I1", "J1", "K1"])];
    reads["SE Short"] = [...new Set([...(reads["SE Short"] || []), "D80", "O80", "D85", "D99", "D106"])];
    const sheets = await runSpreadsheet(generated, taxiCellWrites(scenario, TAX_YEAR_START), reads);

    expect(sheets["Fixed Assets"].I36).toBe(8000 * AIA_RATE);
    expectSameCells(sheets, calculated, [
      ["Fixed Assets", "D36"],
      ["Fixed Assets", "I1"],
      ["Fixed Assets", "J1"],
      ["Fixed Assets", "K1"],
      ["SE Short", "D80"],
      ["SE Short", "O80"],
      ["SE Short", "D85"],
      ["Profit & Loss Acc", "B10"],
    ]);
  }, 600000);
});
