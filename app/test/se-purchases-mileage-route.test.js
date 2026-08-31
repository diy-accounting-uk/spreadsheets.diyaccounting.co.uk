// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-purchases-mileage-route.test.js — a Self Employed package charging
// business miles at the approved rates rather than an amount someone worked
// out by hand. A mileage-log entry reaches the Purchases sheet as miles in
// column D and no amount in column G; the workbook pools those miles with the
// Sales sheet's own into C2, bands the running total at the Admin rates in G2
// and files the claim under Motor Expenses through W2 = IF(F2="v",I2," "),
// with no VAT stripped off it.
//
// Both engines run here: the recalculated workbook through LibreOffice, and
// the pure JS calculator on the same book. Every check the miles carry is
// corrupted one cached value at a time and asserted to fail on its own.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { runMultiFileSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet, setCellValue } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateSeResults } from "../lib/calculators/se.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";
import { extractMultiFileTransactions } from "../lib/xlsx-exporter.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { calculateMileageAllowance } from "../lib/tax/mileage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURE = resolve(APP_DIR, "test", "fixtures", "se-scenario-advanced.toml");
const BOOK_DIR = resolve(ROOT, "examples", "precision-code-ltd", "advanced");

// The year the tax year a package was built for opens in, which is the payroll
// year the Employee sheet's start dates are read against.
const seTaxYearStart = (taxData) => new Date(taxData.tax_year.start).getUTCFullYear();

const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));

// Precision Code's twelve mileage-log entries, and the April one on its own.
const YEAR_MILES = 1365;
const APRIL_MILES = 85;
const YEAR_CLAIM = calculateMileageAllowance(YEAR_MILES, taxData.mileage);
const APRIL_CLAIM = calculateMileageAllowance(APRIL_MILES, taxData.mileage);

const MILEAGE_CHECKS = [
  "Purchases: business miles pooled for the year",
  "Purchases: mileage claimed = those miles at the tax year's approved rates",
  "P&L: Motor Expenses = motoring paid for + the mileage claimed",
];

function failureNames(checks) {
  return checks
    .filter((c) => !c.pass && c.severity !== "warning")
    .map((c) => c.name)
    .sort();
}

// The motoring the business actually paid cash for, net of VAT — everything
// coded "v" that is not a mileage-log entry.
function cashMotorNet(scenario, rate = 0.2) {
  return Object.values(scenario.purchases)
    .flat()
    .filter((tx) => tx.code === "v" && !tx.mileage)
    .reduce((sum, tx) => sum + Math.round((tx.amount / (1 + rate)) * 100) / 100, 0);
}

// Overwrites a cell's cached <v>, leaving the formula tag in place — a stale
// value reaching a reader that only ever sees the last-saved cell.
function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
}

async function readCorruptedCell(filePath, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readCorruptedCell: sheet ${sheetName} not found in ${filePath}`);
  zip.file(sheetPath, corruptCellValue(await zip.file(sheetPath).async("string"), cellRef, newValue));

  const reloadedZip = await JSZip.loadAsync(await zip.generateAsync({ type: "nodebuffer" }));
  const sharedStrings = await loadSharedStrings(reloadedZip);
  return readCellValue(await reloadedZip.file(sheetPath).async("string"), cellRef, sharedStrings);
}

const SKIP = !hasLibreOffice();
const describeExcel = SKIP ? describe.skip : describe;

describeExcel("SE purchases mileage route — the recalculated workbook", () => {
  let results;
  let scenario;
  let merged;
  let saveDir;
  const workDirs = [];

  beforeAll(async () => {
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

    scenario = loadScenario(FIXTURE);
    merged = { ...scenario, ...scenario.expected };
    saveDir = mkdtempSync(join(tmpdir(), "se-purchases-mileage-"));
    workDirs.push(saveDir);
    results = await runMultiFileSpreadsheet(
      fileBuffers,
      seCellWrites(scenario, seTaxYearStart(taxData)),
      seReads(),
      "Financialaccounts.xlsx",
      {
        ...seOptions(),
        saveRecalculatedTo: saveDir,
      },
    );
  }, 600000);

  afterAll(() => {
    for (const dir of workDirs) rmSync(dir, { recursive: true, force: true });
  });

  it("the writer put the miles in column D and left the amount cell empty", () => {
    const april = seCellWrites(scenario, seTaxYearStart(taxData))["Purchases.xlsx"].Apr;
    const mileageCells = Object.keys(april).filter((cell) => /^D\d+$/.test(cell));
    expect(mileageCells).toHaveLength(1);
    const mileageRow = mileageCells[0].slice(1);
    expect(april[`D${mileageRow}`]).toBe(APRIL_MILES);
    expect(april[`F${mileageRow}`]).toBe("v");
    expect(april[`G${mileageRow}`]).toBeUndefined();
  });

  it("pools the year's miles into the running total the last month carries", () => {
    expect(results["Purchases.xlsx!Mar"].C2).toBeCloseTo(YEAR_MILES, 6);
    expect(results["Purchases.xlsx!Apr"].C2).toBeCloseTo(APRIL_MILES, 6);
  });

  it("bands the running total at the Admin sheet's own approved rates", () => {
    expect(results["Purchases.xlsx!Apr"].G2).toBeCloseTo(APRIL_CLAIM, 2);
    expect(results["Purchases.xlsx!Mar"].A2).toBeCloseTo(YEAR_CLAIM, 2);
  });

  it("charges the claim in Motor Expenses beside the motoring paid for in cash, with no VAT taken off it", () => {
    expect(results["Profit & Loss Account"].B25).toBeCloseTo(cashMotorNet(scenario) + YEAR_CLAIM, 2);
    // Priced as an ordinary purchase the claim would have arrived a fifth
    // smaller, which is the bug the D column exists to avoid.
    expect(results["Profit & Loss Account"].B25).not.toBeCloseTo(cashMotorNet(scenario) + YEAR_CLAIM / 1.2, 2);
  });

  it("leaves every month's own check total nil, so the claim reached one expense column and no VAT column", () => {
    for (const tab of ["Apr", "Sep", "Mar"]) {
      expect(results[`Purchases.xlsx!${tab}`].A1).toBeCloseTo(0, 6);
    }
  });

  it("reconciles with the mileage checks live", () => {
    const checks = seCheckCompliance(results, merged, taxData, calculateExpectedTax);
    expect(failureNames(checks)).toEqual([]);
    for (const name of MILEAGE_CHECKS) expect(checks.some((c) => c.name === name)).toBe(true);
  });

  it("fails only the pooled-miles check when the cached running total is corrupted", async () => {
    const corrupted = await readCorruptedCell(join(saveDir, "Purchases.xlsx"), "Mar", "C2", YEAR_MILES + 100);
    const corruptedResults = { ...results, "Purchases.xlsx!Mar": { ...results["Purchases.xlsx!Mar"], C2: corrupted } };
    expect(failureNames(seCheckCompliance(corruptedResults, merged, taxData, calculateExpectedTax))).toEqual([
      "Purchases: business miles pooled for the year",
    ]);
  });

  it("fails only the claimed-at-the-rates check when the cached year-to-date claim is corrupted", async () => {
    const corrupted = await readCorruptedCell(join(saveDir, "Purchases.xlsx"), "Mar", "A2", YEAR_CLAIM + 50);
    const corruptedResults = { ...results, "Purchases.xlsx!Mar": { ...results["Purchases.xlsx!Mar"], A2: corrupted } };
    expect(failureNames(seCheckCompliance(corruptedResults, merged, taxData, calculateExpectedTax))).toEqual([
      "Purchases: mileage claimed = those miles at the tax year's approved rates",
    ]);
  });

  it("fails the Motor Expenses checks when the cached P&L motoring line is corrupted", async () => {
    const pl = results["Profit & Loss Account"];
    const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Profit & Loss Account", "B25", pl.B25 - 500);
    const corruptedResults = { ...results, "Profit & Loss Account": { ...pl, B25: corrupted } };
    const failed = failureNames(seCheckCompliance(corruptedResults, merged, taxData, calculateExpectedTax));
    expect(failed).toContain("P&L: Motor Expenses = motoring paid for + the mileage claimed");
    expect(failed).toContain("Motor Expenses");
  });

  it("prices every mileage row back out of the package at the claim the sheet made of it", async () => {
    const lines = await extractMultiFileTransactions(saveDir, "se");
    const mileageLines = lines.filter((l) => l.measurableUnitOfMeasure === "miles");
    expect(mileageLines).toHaveLength(12);
    expect(mileageLines.reduce((sum, l) => sum + l.measurableQuantity, 0)).toBe(YEAR_MILES);
    expect(mileageLines.reduce((sum, l) => sum + l.amount, 0)).toBeCloseTo(YEAR_CLAIM, 2);
    for (const line of mileageLines) {
      expect(line.sourceJournalID).toBe("purchases");
      expect(line.documentType).toBe("mileage-log");
      expect(line.accountMainID).toBe("5601");
    }
    const april = mileageLines.find((l) => l.postingDate.startsWith("2025-04"));
    expect(april.measurableQuantity).toBe(APRIL_MILES);
    expect(april.amount).toBeCloseTo(APRIL_CLAIM, 2);
  });

  it("keeps reading the rows that follow a mileage row, which carries no amount to stop on", async () => {
    const lines = await extractMultiFileTransactions(saveDir, "se");
    const fixturePurchases = Object.values(scenario.purchases).flat().length;
    expect(lines.filter((l) => l.sourceJournalID === "purchases")).toHaveLength(fixturePurchases);
  });

  it("is broken by corrupting the miles cell -- the export reads the sheet, not a fixed value", async () => {
    const corruptedDir = mkdtempSync(join(tmpdir(), "se-purchases-mileage-corrupt-"));
    workDirs.push(corruptedDir);
    const { cpSync, writeFileSync } = await import("fs");
    cpSync(saveDir, corruptedDir, { recursive: true });

    const zip = await JSZip.loadAsync(readFileSync(join(saveDir, "Purchases.xlsx")));
    const sheetPath = (await buildSheetMap(zip)).get("Apr");
    const originalDate = zip.file(sheetPath).date;
    const milesCell = Object.keys(seCellWrites(scenario, seTaxYearStart(taxData))["Purchases.xlsx"].Apr).find((cell) =>
      /^D\d+$/.test(cell),
    );
    zip.file(sheetPath, setCellValue(await zip.file(sheetPath).async("string"), milesCell, 999), { date: originalDate });
    writeFileSync(join(corruptedDir, "Purchases.xlsx"), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

    const lines = await extractMultiFileTransactions(corruptedDir, "se");
    const april = lines.find((l) => l.measurableUnitOfMeasure === "miles" && l.postingDate.startsWith("2025-04"));
    expect(april.measurableQuantity).toBe(999);
    expect(april.amount).toBeCloseTo(calculateMileageAllowance(999, taxData.mileage), 2);
    expect(april.amount).not.toBeCloseTo(APRIL_CLAIM, 2);
  });
});

describe("SE purchases mileage route — the JS calculator", () => {
  const { book, lines } = loadDiyaGlData(BOOK_DIR);
  const scenario = diyaGlToScenario(book, lines, "se");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateSeResults(book, lines, taxData, merged);

  it("carries the miles the purchase journal recorded", () => {
    expect(merged.total_mileage).toBe(YEAR_MILES);
    expect(results["Purchases.xlsx!Mar"].C2).toBeCloseTo(YEAR_MILES, 6);
  });

  it("prices them at the tax year's approved rates", () => {
    expect(results["Purchases.xlsx!Mar"].A2).toBeCloseTo(YEAR_CLAIM, 2);
  });

  it("charges the claim in Motor Expenses", () => {
    expect(results["Profit & Loss Account"].B25).toBeCloseTo(cashMotorNet(merged) + YEAR_CLAIM, 2);
  });

  it("the claim reaches the Income Tax sheet through the profit", () => {
    const withoutMileageLines = lines.filter((l) => !(l.sourceJournalID === "purchases" && l.measurableUnitOfMeasure === "miles"));
    const withoutScenario = diyaGlToScenario(book, withoutMileageLines, "se");
    const withoutClaim = calculateSeResults(book, withoutMileageLines, taxData, { ...withoutScenario, ...withoutScenario.expected });
    expect(withoutClaim["Purchases.xlsx!Mar"].A2).toBe(0);
    expect(withoutClaim["Profit & Loss Account"].B25).toBeCloseTo(results["Profit & Loss Account"].B25 - YEAR_CLAIM, 2);
    expect(withoutClaim["Income Tax"].E11).toBeGreaterThan(results["Income Tax"].E11);
  });

  it("the checks it passes fail when a mileage-log entry loses ten miles", () => {
    expect(failureNames(seCheckCompliance(results, merged, taxData, calculateExpectedTax))).toEqual([]);

    const shortByTenMiles = lines.map((l) =>
      l.sourceJournalID === "purchases" && l.measurableUnitOfMeasure === "miles"
        ? { ...l, measurableQuantity: l.measurableQuantity - 10 }
        : l,
    );
    const mutated = diyaGlToScenario(book, shortByTenMiles, "se");
    const after = seCheckCompliance(
      calculateSeResults(book, shortByTenMiles, taxData, { ...mutated, ...mutated.expected }),
      merged,
      taxData,
      calculateExpectedTax,
    );
    for (const name of MILEAGE_CHECKS) {
      expect(after.find((c) => c.name === name).pass).toBe(false);
    }
  });
});
