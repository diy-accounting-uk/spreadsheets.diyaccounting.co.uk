// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-vat-localisation.test.js — Proves the Self Employed VAT checks name the
// place a break happened, not just that one happened. Each corruption is
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
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";
import { parse as parseTOML } from "smol-toml";

const describeCalc = hasLibreOffice() ? describe : describe.skip;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

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
  "Self Employed: the VAT chain names where it broke",
  () => {
    let results;
    let taxData;
    let expected;
    let savedDir;

    function checksWithCorruptedCell(resultKey, cellRef, value) {
      const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
      return seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
    }

    beforeAll(async () => {
      taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
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

      const scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml"));
      expected = { ...scenario, ...scenario.expected };

      savedDir = mkdtempSync(join(tmpdir(), "se-vat-localisation-"));
      results = await runMultiFileSpreadsheet(fileBuffers, seCellWrites(scenario), seReads(), "Financialaccounts.xlsx", {
        ...seOptions(),
        saveRecalculatedTo: savedDir,
      });
    }, 900000);

    afterAll(() => {
      if (savedDir) rmSync(savedDir, { recursive: true, force: true });
    });

    it("carries each month's own sales and purchases VAT onto its interface row", () => {
      const vatinterface = results["Vat.xlsx!Vatinterface"];
      expect(vatinterface.F9).toBe(results["Sales.xlsx!Jul"].H1);
      expect(vatinterface.D9).toBe(results["Sales.xlsx!Jul"].I1);
      expect(vatinterface.J17).toBe(results["Purchases.xlsx!Mar"].H1);
      expect(vatinterface.H17).toBe(results["Purchases.xlsx!Mar"].I1);
      expect(vatinterface.F9).toBeGreaterThan(0);
    });

    it("puts the straddling periods on the rows either side of the year", () => {
      const vatinterface = results["Vat.xlsx!Vatinterface"];
      // 4800 gross before the year, 3600 gross after it, both at 20%.
      expect(vatinterface.D4).toBe(4000);
      expect(vatinterface.F4).toBe(800);
      expect(vatinterface.D18).toBe(3000);
      expect(vatinterface.F18).toBe(600);
      expect(vatinterface.H18).toBe(200);
      expect(vatinterface.J18).toBe(40);
    });

    it("reaches the last two VAT quarters without reaching the books", () => {
      const vatinterface = results["Vat.xlsx!Vatinterface"];
      // A 6 April year end puts the fourth and fifth quarters on the rows the
      // straddling entry sheets feed, so their boxes carry that data.
      expect(results["Vat.xlsx!VATQtr4"].G9).toBe(vatinterface.G18);
      expect(vatinterface.G18).toBe(vatinterface.F16 + vatinterface.F17 + vatinterface.F18);
      expect(results["Vat.xlsx!VATQtr5"].G9).toBe(vatinterface.G19);
      expect(results["Profit & Loss Account"].B9).toBeCloseTo(expected.total_sales, 0);
    });

    it("fails one month and one side when an interface month cell is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Vat.xlsx", "Vatinterface", "F9", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Vat.xlsx!Vatinterface", "F9", value);
      expect(failureNames(corrupted)).toEqual([
        "Vatinterface F9: Jul output VAT = Sales.xlsx Jul",
        "Vatinterface G9: quarter output VAT = its three period rows",
      ]);
    });

    it("fails the quarter column and the box it feeds when the interface sum is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Vat.xlsx", "Vatinterface", "G9", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Vat.xlsx!Vatinterface", "G9", value);
      expect(failureNames(corrupted)).toEqual([
        "Vatinterface G9: quarter output VAT = its three period rows",
        "VAT Q1: box 1 (G9) = Vatinterface quarter VAT due (G9)",
      ]);
    });

    it("fails the straddling period's own row when it is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Vat.xlsx", "Vatinterface", "D18", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Vat.xlsx!Vatinterface", "D18", value);
      expect(failureNames(corrupted)).toEqual([
        "Vatinterface D18: 04Y2 sales net = the straddling sales entered for that period",
        "Vatinterface E18: quarter sales net = its three period rows",
      ]);
    });
  },
  900000,
);
