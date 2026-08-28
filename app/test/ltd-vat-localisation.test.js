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
      expect(vatinterface.F6).toBe(results["Sales.xlsx!Apr"].G1);
      expect(vatinterface.D6).toBe(results["Sales.xlsx!Apr"].H1);
      expect(vatinterface.J17).toBe(results["Purchases.xlsx!Mar"].G1);
      expect(vatinterface.H17).toBe(results["Purchases.xlsx!Mar"].H1);
      expect(vatinterface.F6).toBeGreaterThan(0);
    });

    it("puts the straddling periods on the rows either side of the year", () => {
      const vatinterface = results["Vatreturns.xlsx!Vatinterface"];
      // 4800 gross before the year, 3600 gross after it, both at 20%.
      expect(vatinterface.D4).toBe(4000);
      expect(vatinterface.F4).toBe(800);
      expect(vatinterface.D18).toBe(3000);
      expect(vatinterface.F18).toBe(600);
      expect(vatinterface.H18).toBe(200);
      expect(vatinterface.J18).toBe(40);
    });

    it("reaches the fifth VAT quarter's boxes without reaching the books", () => {
      const vatinterface = results["Vatreturns.xlsx!Vatinterface"];
      const qtr5 = results["Vatreturns.xlsx!VATQtr5"];
      // Q5 is the quarter ending on the straddling row, so its box 1 is the
      // year's last two months plus the straddling period's own output VAT.
      expect(qtr5.G9).toBe(vatinterface.G18);
      expect(vatinterface.G18).toBe(vatinterface.F16 + vatinterface.F17 + vatinterface.F18);
      expect(qtr5.G15).toBe(vatinterface.K18);
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
      expect(failureNames(corrupted)).toEqual([
        "VAT: Q1-Q4 box 1 = Sales VAT",
        "VAT Q1: box 5 = box 3 - box 4",
        "VAT Q1: box 1 (G9) = Vatinterface quarter VAT due (G8)",
      ]);
    });

    it("fails the straddling period's own row when it is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Vatreturns.xlsx", "Vatinterface", "D18", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Vatreturns.xlsx!Vatinterface", "D18", value);
      expect(failureNames(corrupted)).toEqual([
        "Vatinterface D18: 04Y2 sales net = the straddling sales entered for that period",
        "Vatinterface E18: quarter sales net = its three period rows",
      ]);
    });
  },
  900000,
);
