// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-wages-forecast-checks.test.js — Proves the Taxi Wages Forecast checks
// catch a broken workbook. The forecast prints its own tax and NI liability
// and the P&L's financial health check charges a twelfth of it every month,
// so a wrong figure here reaches the customer's drawings plan.
//
// Each check runs on a real LibreOffice-recalculated workbook, then again
// after corrupting one cell's cached value in a copy of the xlsx via JSZip.
// The corrupted run has to fail exactly the checks that read the cell and
// nothing else.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { runSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as taxiCellWrites, standardReads as taxiReads, checkCompliance as taxiCheckCompliance } from "../products/taxi.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const FORECAST_SHEET = "Wages Forecast";

function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
}

async function readCorruptedCell(path, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readCorruptedCell: sheet ${sheetName} not found`);
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

const FORECAST_CHECK_NAMES = [
  "Forecast: months of actual trade = P&L months with turnover",
  "Forecast: months of actual trade = the fixture's",
  "Forecast: turnover = the traded months plus the year spread over the rest",
  "Forecast: cost of sales = the traded months plus the year spread over the rest",
  "Forecast: general expenses = the traded months plus the year spread over the rest",
  "Forecast: turnover = P&L turnover",
  "Forecast: other business income = P&L other business income",
  "Forecast: cost of sales = P&L cost of sales",
  "Forecast: general expenses = P&L general expenses",
  "Forecast: profit = turnover + other income - cost of sales - expenses",
  "Forecast: personal allowance after taper",
  "Forecast: tax at standard rate",
  "Forecast: tax at higher rate",
  "Forecast: tax at additional rate",
  "Forecast: National Insurance",
  "Forecast: tax and NI liability",
];

const TAX_BLOCK_CHECKS = [
  "Forecast: personal allowance after taper",
  "Forecast: tax at standard rate",
  "Forecast: tax at higher rate",
  "Forecast: tax at additional rate",
  "Forecast: National Insurance",
  "Forecast: tax and NI liability",
];

describeCalc("Taxi wages forecast checks catch a broken workbook", () => {
  let results;
  let checks;
  let taxData;
  let expected;
  let populatedPath;

  function checksWithCorruptedCell(resultKey, cellRef, value) {
    const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
    return taxiCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
  }

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    const scenario = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-kestrel.toml"));
    expected = { ...scenario, ...scenario.expected };

    populatedPath = join(mkdtempSync(join(tmpdir(), "taxi-wages-forecast-")), "populated.xlsx");
    results = await runSpreadsheet(xlsxBuffer, taxiCellWrites(scenario), taxiReads(), { saveRecalculatedTo: populatedPath });
    checks = taxiCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 120000);

  it("passes every forecast check on the intact book", () => {
    for (const name of FORECAST_CHECK_NAMES) {
      const check = checks.find((c) => c.name === name);
      expect(check, `missing check: ${name}`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }
  });

  it("projects the whole year when every month traded", () => {
    const forecast = results[FORECAST_SHEET];
    const pl = results["Profit & Loss Acc"];
    expect(forecast.C19).toBe(12);
    expect(forecast.C30).toBeCloseTo(145258, 2);
    // The forecast profit is the net profit plus the year's other business
    // income: the P&L takes its own net profit before that row, the forecast
    // adds it in.
    expect(forecast.C30).toBeCloseTo(pl.B23 + pl.B24, 0);
  });

  // Hand-computed from the 2025-26 rates on the forecast profit of 145,258:
  // the allowance is nil because the profit is more than 25,140 above the
  // 100,000 taper threshold; 37,700 at 20% is 7,540; 37,700 to 125,140 at 40%
  // is 34,976; the remaining 20,118 at 45% is 9,053.10. Class 4 is 6% between
  // 12,570 and 50,270 (2,262) plus 2% on the 94,988 above (1,899.76).
  it("charges the forecast profit the statutory amount", () => {
    const forecast = results[FORECAST_SHEET];
    expect(forecast.C34).toBeCloseTo(145258, 2);
    expect(forecast.C35).toBe(0);
    expect(forecast.C36).toBeCloseTo(145258, 2);
    expect(forecast.C37).toBeCloseTo(7540, 2);
    expect(forecast.C38).toBeCloseTo(34976, 2);
    expect(forecast.C39).toBeCloseTo(9053.1, 2);
    expect(forecast.C40).toBeCloseTo(4161.76, 2);
    expect(forecast.C41).toBeCloseTo(55730.86, 2);
  });

  it.each([
    [
      FORECAST_SHEET,
      "C19",
      1,
      ["Forecast: months of actual trade = P&L months with turnover", "Forecast: months of actual trade = the fixture's"],
    ],
    [
      FORECAST_SHEET,
      "C20",
      1,
      [
        "Forecast: turnover = P&L turnover",
        "Forecast: turnover = the traded months plus the year spread over the rest",
        "Forecast: profit = turnover + other income - cost of sales - expenses",
      ],
    ],
    [
      FORECAST_SHEET,
      "C22",
      1,
      [
        "Forecast: other business income = P&L other business income",
        "Forecast: profit = turnover + other income - cost of sales - expenses",
      ],
    ],
    [
      FORECAST_SHEET,
      "C24",
      1,
      [
        "Forecast: cost of sales = P&L cost of sales",
        "Forecast: cost of sales = the traded months plus the year spread over the rest",
        "Forecast: profit = turnover + other income - cost of sales - expenses",
      ],
    ],
    [
      FORECAST_SHEET,
      "C28",
      1,
      [
        "Forecast: general expenses = P&L general expenses",
        "Forecast: general expenses = the traded months plus the year spread over the rest",
        "Forecast: profit = turnover + other income - cost of sales - expenses",
      ],
    ],
    [FORECAST_SHEET, "C30", 1, ["Forecast: profit = turnover + other income - cost of sales - expenses"]],
    [FORECAST_SHEET, "C34", 1, TAX_BLOCK_CHECKS],
    [FORECAST_SHEET, "C35", 5000, ["Forecast: personal allowance after taper"]],
    [FORECAST_SHEET, "C37", 1, ["Forecast: tax at standard rate"]],
    [FORECAST_SHEET, "C38", 1, ["Forecast: tax at higher rate"]],
    [FORECAST_SHEET, "C39", 1, ["Forecast: tax at additional rate"]],
    [FORECAST_SHEET, "C40", 1, ["Forecast: National Insurance"]],
    [FORECAST_SHEET, "C41", 1, ["Forecast: tax and NI liability"]],
  ])("corrupting %s!%s via JSZip fails exactly the checks that read it", async (sheet, cellRef, corruptedValue, expectedFailures) => {
    for (const name of expectedFailures) {
      expect(checks.find((c) => c.name === name).pass, `${name} should pass on the intact book`).toBe(true);
    }

    const value = await readCorruptedCell(populatedPath, sheet, cellRef, corruptedValue);
    expect(value).toBe(corruptedValue);
    const corrupted = checksWithCorruptedCell(sheet, cellRef, value);
    expect(failureNames(corrupted).sort()).toEqual([...expectedFailures].sort());
  });
});
