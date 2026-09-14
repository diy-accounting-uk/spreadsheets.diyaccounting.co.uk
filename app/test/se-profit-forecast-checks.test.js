// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// se-profit-forecast-checks.test.js — Proves the Self Employed Profit Forecast
// checks catch a broken workbook. The forecast prints its own tax and NI
// liability and the profit and loss account charges a twelfth of it every
// month on its financial health check, so a wrong figure here reaches the
// customer's drawings plan.
//
// The block runs off the Admin sheet's own rates, so it is proven on two
// years: the 2025-26 rates the current package ships with, and the 2023-24
// rates behind the 2024-04-05 year end, where Class 4 is still 9% and 2%.
//
// Each check runs on a real LibreOffice-recalculated package, then again after
// corrupting one cell's cached value in a copy of Financialaccounts.xlsx via
// JSZip. The corrupted run has to fail exactly the checks that read the cell
// and nothing else.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, mkdtempSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { runMultiFileSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateIncomeTax, calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";
import { parse as parseTOML } from "smol-toml";
import { vatRateForScenario, depreciationAndDisposalLoss, capitalAllowancesFromSchedule } from "./helpers/se-fixture-figures.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

// The year the tax year a package was built for opens in, which is the payroll
// year the Employee sheet's start dates are read against.
const seTaxYearStart = (taxData) => new Date(taxData.tax_year.start).getUTCFullYear();

// The 5 April year end cellWrites' own shift is built for, so checkCompliance
// derives the same monthOffset it did: passing seTaxYearStart(taxData) as
// cellWrites' targetStartYear but nothing as checkCompliance's packageYearEnd
// left the payslip date checks comparing a shifted package to an unshifted
// expectation on the 2023-24 rates, which sit two years short of the
// scenario's own 2025 opening.
const sePackageYearEnd = (taxData) => `${seTaxYearStart(taxData) + 1}-04-05`;

const FORECAST_SHEET = "Profit Forecast";

// The taxable profit (C39) is the accounting profit the P&L carries (B39)
// plus the disposal loss and depreciation added back (B33 + B34) less the
// capital allowances the fixed asset schedule carries (Schedule!Q1 + R1 +
// AC1 + Y1 - Z1). It is the same in both rate years, because neither
// figure depends on the tax year's own rates; every income tax and Class 4
// figure below it (C40-C46) is derived off the same taxable profit through
// income-tax.js's own calculators, independent of the SE engine under
// test. C39 is anchored on the recalculated book's own P&L and schedule
// cells (results, not a JS mirror of them); C40-C46 read the tax year's
// own rate tables, so both years move together whenever the fixture does.
const RATE_YEARS = [
  { label: "2025-26", taxDataFile: "se-2025-2026.toml" },
  { label: "2023-24", taxDataFile: "se-2023-2024.toml" },
];

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
  "Forecast: turnover = P&L turnover",
  "Forecast: investment grants = P&L investment grants",
  "Forecast: cost of sales = P&L cost of sales",
  "Forecast: general expenses = P&L administrative expenses",
  "Forecast: interest received = P&L interest received",
  "Forecast: profit before tax = P&L profit before tax",
  "Forecast: depreciation added back = P&L disposal loss + depreciation",
  "Forecast: capital allowances = the fixed asset schedule",
  "Forecast: taxable profit = profit + depreciation - capital allowances",
  "Forecast: personal allowance after taper",
  "Forecast: tax at standard rate",
  "Forecast: tax at higher rate",
  "Forecast: tax at additional rate",
  "Forecast: National Insurance",
  "Forecast: tax and NI liability",
];

// Everything the tax block reads off the taxable profit. The additional band
// is nil on this fixture and stays nil when the profit is corrupted downward,
// so it is not in the list a corrupted C39 has to break.
const TAX_BLOCK_CHECKS = [
  "Forecast: personal allowance after taper",
  "Forecast: tax at standard rate",
  "Forecast: tax at higher rate",
  "Forecast: National Insurance",
  "Forecast: tax and NI liability",
];

for (const rateYear of RATE_YEARS) {
  describeCalc(`Self Employed profit forecast checks catch a broken workbook on the ${rateYear.label} rates`, () => {
    let results;
    let checks;
    let taxData;
    let expected;
    let scenario;
    let saveDir;

    function checksWithCorruptedCell(resultKey, cellRef, value) {
      const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
      return seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax, sePackageYearEnd(taxData));
    }

    beforeAll(async () => {
      taxData = parseTOML(readFileSync(resolve(DATA_DIR, rateYear.taxDataFile), "utf8"));
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

      scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml"));
      expected = { ...scenario, ...scenario.expected };

      saveDir = mkdtempSync(join(tmpdir(), "se-profit-forecast-"));
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
      checks = seCheckCompliance(results, expected, taxData, calculateExpectedTax, sePackageYearEnd(taxData));
    }, 600000);

    it("passes every forecast check on the intact book", () => {
      for (const name of FORECAST_CHECK_NAMES) {
        const check = checks.find((c) => c.name === name);
        expect(check, `missing check: ${name}`).toBeDefined();
        expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
      }
    });

    it("projects the whole year when every month traded", () => {
      const forecast = results[FORECAST_SHEET];
      const pl = results["Profit & Loss Account"];
      expect(forecast.C21).toBe(12);
      expect(forecast.C34).toBeCloseTo(pl.B39, 4);
    });

    it("charges the forecast profit the statutory amount", () => {
      const forecast = results[FORECAST_SHEET];
      const pl = results["Profit & Loss Account"];

      // C39: the recalculated book's own accounting profit (B39) plus its
      // own disposal loss and depreciation add-back (B33 + B34), less the
      // capital allowances derived independently from the fixture's asset
      // and disposal rows (not read back off Schedule.xlsx).
      const rate = vatRateForScenario(scenario, taxData);
      const { totalDepreciation, disposalLoss } = depreciationAndDisposalLoss(scenario, taxData, rate);
      const capitalAllowances = capitalAllowancesFromSchedule(scenario, taxData, rate).total;
      const expectedC39 = pl.B39 + totalDepreciation + disposalLoss - capitalAllowances;
      expect(forecast.C39).toBeCloseTo(expectedC39, 4);

      // C40-C46: income-tax.js's own calculators, independent of the SE
      // engine, run on that same taxable profit and the tax year's rates.
      const incomeTax = calculateIncomeTax(expectedC39, taxData.income_tax);
      const expectedTax = calculateExpectedTax(expectedC39, taxData);
      expect(forecast.C40).toBeCloseTo(incomeTax.personalAllowance, 4);
      expect(forecast.C41).toBeCloseTo(incomeTax.taxableIncome, 4);
      expect(forecast.C42).toBeCloseTo(incomeTax.basicRateTax, 2);
      expect(forecast.C43).toBeCloseTo(incomeTax.higherRateTax, 2);
      expect(forecast.C44).toBeCloseTo(incomeTax.additionalRateTax, 2);
      expect(forecast.C45).toBeCloseTo(expectedTax.ni_class4_lower + expectedTax.ni_class4_upper, 4);
      expect(forecast.C46).toBeCloseTo(expectedTax.total_tax_and_ni, 4);
    });

    it.each([
      [FORECAST_SHEET, "C21", 1, ["Forecast: months of actual trade = P&L months with turnover"]],
      [FORECAST_SHEET, "C22", 1, ["Forecast: turnover = P&L turnover"]],
      [FORECAST_SHEET, "C24", 1, ["Forecast: investment grants = P&L investment grants"]],
      [FORECAST_SHEET, "C26", 1, ["Forecast: cost of sales = P&L cost of sales"]],
      [FORECAST_SHEET, "C30", 1, ["Forecast: general expenses = P&L administrative expenses"]],
      [FORECAST_SHEET, "C33", 5, ["Forecast: interest received = P&L interest received"]],
      [
        FORECAST_SHEET,
        "C34",
        1,
        ["Forecast: profit before tax = P&L profit before tax", "Forecast: taxable profit = profit + depreciation - capital allowances"],
      ],
      [
        FORECAST_SHEET,
        "C37",
        1,
        [
          "Forecast: depreciation added back = P&L disposal loss + depreciation",
          "Forecast: taxable profit = profit + depreciation - capital allowances",
        ],
      ],
      [
        FORECAST_SHEET,
        "C38",
        1,
        [
          "Forecast: capital allowances = the fixed asset schedule",
          "Forecast: taxable profit = profit + depreciation - capital allowances",
        ],
      ],
      [FORECAST_SHEET, "C39", 1, ["Forecast: taxable profit = profit + depreciation - capital allowances", ...TAX_BLOCK_CHECKS]],
      [FORECAST_SHEET, "C40", 5000, ["Forecast: personal allowance after taper"]],
      [FORECAST_SHEET, "C42", 1, ["Forecast: tax at standard rate"]],
      [FORECAST_SHEET, "C43", 1, ["Forecast: tax at higher rate"]],
      [FORECAST_SHEET, "C44", 5, ["Forecast: tax at additional rate"]],
      [FORECAST_SHEET, "C45", 1, ["Forecast: National Insurance"]],
      [FORECAST_SHEET, "C46", 1, ["Forecast: tax and NI liability"]],
    ])("corrupting %s!%s via JSZip fails exactly the checks that read it", async (sheet, cellRef, corruptedValue, expectedFailures) => {
      for (const name of expectedFailures) {
        expect(checks.find((c) => c.name === name).pass, `${name} should pass on the intact book`).toBe(true);
      }

      const value = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), sheet, cellRef, corruptedValue);
      expect(value).toBe(corruptedValue);
      const corrupted = checksWithCorruptedCell(sheet, cellRef, value);
      expect(failureNames(corrupted).sort()).toEqual([...expectedFailures].sort());
    });
  });
}
