// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-vat-localisation.test.js — Proves the Limited Company VAT checks name
// the place a break happened, not just that one happened. Each corruption is
// applied to a copy of a real recalculated package via JSZip (the cached
// value overwritten, the formula left in place), and the resulting failure
// set is asserted exactly: a month link fails on its own month and side, a
// quarter column fails on its own row, a VAT box fails on its own box.
//
// Also covers the straddling VAT periods, whose entry sheets reach the VAT
// return without ever touching the books.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { runMultiFileSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as ltdCellWrites,
  standardReads as ltdReads,
  multiFileOptions as ltdOptions,
  checkCompliance as ltdCheckCompliance,
} from "../products/ltd.js";
import { parse as parseTOML } from "smol-toml";

const describeCalc = hasLibreOffice() ? describe : describe.skip;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const YEAR_END_MONTH = 3;

function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
}

async function readCorruptedCell(savedDir, fileName, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, fileName)));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readCorruptedCell: sheet ${sheetName} not found in ${fileName}`);
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

// Dating the spare fifth form on the fourth's own period leaves the five forms
// naming four periods, takes the fifth off the last period the interface
// carries, and leaves its own boxes reading the row it used to name.
const LTD_FIFTH_ON_FOURTH_FAILURES = [
  "VAT Q5: box 1 (G9) = Vatinterface quarter VAT due (G17)",
  "VAT Q5: box 4 (G15) = Vatinterface quarter VAT reclaimed (K17)",
  "VAT Q5: box 7 (G23) = Vatinterface quarter purchases net (I17)",
  "VAT Q5: box 6 (G21) = Vatinterface quarter sales net of VAT",
  "VAT Q5: payment due date (G7) = Vatinterface final date for payment (C17)",
  "VAT: the five returns end on five different periods",
  "VAT: Q5 ends on the last period the Vatinterface carries",
];

// Moving the second form one month late breaks the quarterly step on both
// sides of it and leaves two accounting months no quarterly return reaches.
const LTD_SECOND_OFF_QUARTER_FAILURES = [
  "VAT Q2: box 1 (G9) = Vatinterface quarter VAT due (G9)",
  "VAT Q2: box 4 (G15) = Vatinterface quarter VAT reclaimed (K9)",
  "VAT Q2: box 7 (G23) = Vatinterface quarter purchases net (I9)",
  "VAT Q2: box 6 (G21) = Vatinterface quarter sales net of VAT",
  "VAT Q2: payment due date (G7) = Vatinterface final date for payment (C9)",
  "VAT: Q2 ends a quarter after Q1",
  "VAT: Q3 ends a quarter after Q2",
  "VAT: Q1-Q4 cover every month of the accounting year",
];

describeCalc(
  "Limited Company: the VAT chain names where it broke",
  () => {
    let results;
    let checks;
    let taxData;
    let expected;
    let savedDir;

    function checksWithCorruptedCell(resultKey, cellRef, value) {
      const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
      return ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
    }

    beforeAll(async () => {
      taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));

      const fileBuffers = {};
      for (const templateFile of productMeta.template.files) {
        const templateBuffer = readFileSync(resolve(LTD_DIR, templateFile));
        const fileKey = templateFile.replace(".xlsx", "").replace(".docx", "").toLowerCase();
        const sheetsConfig = productMeta.sheets?.[fileKey];
        fileBuffers[templateFile] =
          sheetsConfig && Object.keys(sheetsConfig).length > 0
            ? await generateSpreadsheet(templateBuffer, taxData, sheetsConfig)
            : templateBuffer;
      }

      const scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-scenario-full.toml"));
      expected = { ...scenario, ...scenario.expected };

      savedDir = mkdtempSync(join(tmpdir(), "ltd-vat-localisation-"));
      results = await runMultiFileSpreadsheet(
        fileBuffers,
        ltdCellWrites(scenario, 2025, YEAR_END_MONTH),
        ltdReads(),
        "Financialaccounts.xlsx",
        { ...ltdOptions(YEAR_END_MONTH), saveRecalculatedTo: savedDir },
      );
      checks = ltdCheckCompliance(results, expected, taxData, calculateExpectedTax);
    }, 900000);

    afterAll(() => {
      if (savedDir) rmSync(savedDir, { recursive: true, force: true });
    });

    it("passes every check on the intact book", () => {
      expect(failureNames(checks)).toEqual([]);
    });

    it("carries each month's own sales and purchases VAT onto its interface row", () => {
      const vatinterface = results["Vatreturns.xlsx!Vatinterface"];
      expect(vatinterface.F6).toBeCloseTo(results["Sales.xlsx!Apr"].G1, 6);
      expect(vatinterface.D6).toBeCloseTo(results["Sales.xlsx!Apr"].H1, 6);
      expect(vatinterface.J17).toBeCloseTo(results["Purchases.xlsx!Mar"].G1, 6);
      expect(vatinterface.H17).toBeCloseTo(results["Purchases.xlsx!Mar"].H1, 6);
      expect(vatinterface.F6).toBeGreaterThan(0);
    });

    it("puts the straddling periods on the rows either side of the year", () => {
      const vatinterface = results["Vatreturns.xlsx!Vatinterface"];
      // 4800 gross before the year, 3600 then 1800 gross after it, all at 20%.
      expect(vatinterface.D4).toBeCloseTo(4000, 6);
      expect(vatinterface.F4).toBeCloseTo(800, 6);
      expect(vatinterface.D18).toBeCloseTo(3000, 6);
      expect(vatinterface.F18).toBeCloseTo(600, 6);
      expect(vatinterface.H18).toBeCloseTo(200, 6);
      expect(vatinterface.J18).toBeCloseTo(40, 6);
      expect(vatinterface.D19).toBeCloseTo(1500, 6);
      expect(vatinterface.F19).toBeCloseTo(300, 6);
      expect(vatinterface.H19).toBeCloseTo(300, 6);
      expect(vatinterface.J19).toBeCloseTo(60, 6);
    });

    it("reaches the spare fifth return's boxes without reaching the books", () => {
      const vatinterface = results["Vatreturns.xlsx!Vatinterface"];
      const qtr5 = results["Vatreturns.xlsx!VATQtr5"];
      // Q5 sits on the last period the interface carries, so its box 1 is the
      // year's own last month plus both straddling periods after the year end.
      expect(qtr5.G9).toBeCloseTo(vatinterface.G19, 6);
      expect(vatinterface.G19).toBeCloseTo(vatinterface.F17 + vatinterface.F18 + vatinterface.F19, 6);
      expect(qtr5.G15).toBeCloseTo(vatinterface.K19, 6);
      // The books never see any of it.
      expect(Math.abs(results.TrialBalance.EJ91)).toBeLessThanOrEqual(1);
      expect(results["MnthP&L"].B9).toBeCloseTo(expected.total_sales, 0);
    });

    it("fails one month and one side when an interface month cell is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Vatreturns.xlsx", "Vatinterface", "F6", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Vatreturns.xlsx!Vatinterface", "F6", value);
      expect(failureNames(corrupted)).toEqual([
        "Vatinterface F6: Apr output VAT = Sales.xlsx Apr",
        "Vatinterface G8: quarter output VAT = its three period rows",
      ]);
    });

    it("fails the quarter column and the box it feeds when the interface sum is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Vatreturns.xlsx", "Vatinterface", "G8", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Vatreturns.xlsx!Vatinterface", "G8", value);
      expect(failureNames(corrupted)).toEqual([
        "Vatinterface G8: quarter output VAT = its three period rows",
        "VAT Q1: box 1 (G9) = Vatinterface quarter VAT due (G8)",
      ]);
    });

    it("fails the box and the annual total when a VAT box is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Vatreturns.xlsx", "VATQtr1", "G9", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Vatreturns.xlsx!VATQtr1", "G9", value);
      expect(failureNames(corrupted)).toEqual(["VAT: Q1-Q4 box 1 = Sales VAT", "VAT Q1: box 1 (G9) = Vatinterface quarter VAT due (G8)"]);
    });

    it("fails the straddling period's own row when it is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Vatreturns.xlsx", "Vatinterface", "D18", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Vatreturns.xlsx!Vatinterface", "D18", value);
      expect(failureNames(corrupted)).toEqual([
        "Vatinterface D18: 04Y2 sales net = the straddling sales entered for that period",
        "Vatinterface E19: quarter sales net = its three period rows",
      ]);
    });

    it("fails the cycle when the spare fifth return is dated on the fourth's period", async () => {
      const fourthEnd = results["Vatreturns.xlsx!VATQtr4"].G5;
      const value = await readCorruptedCell(savedDir, "Vatreturns.xlsx", "VATQtr5", "G5", fourthEnd);
      expect(value).toBe(fourthEnd);
      const corrupted = checksWithCorruptedCell("Vatreturns.xlsx!VATQtr5", "G5", value);
      expect(failureNames(corrupted)).toEqual(LTD_FIFTH_ON_FOURTH_FAILURES);
    });

    it("fails the cycle when a middle return is dated a month off its quarter", async () => {
      const oneMonthLate = results["Vatreturns.xlsx!Vatinterface"].B9;
      const value = await readCorruptedCell(savedDir, "Vatreturns.xlsx", "VATQtr2", "G5", oneMonthLate);
      expect(value).toBe(oneMonthLate);
      const corrupted = checksWithCorruptedCell("Vatreturns.xlsx!VATQtr2", "G5", value);
      expect(failureNames(corrupted)).toEqual(LTD_SECOND_OFF_QUARTER_FAILURES);
    });
  },
  900000,
);
